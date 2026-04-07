const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const env = require("../config/env");
const ModelAuditLog = require("../models/ModelAuditLog");
const {
  normalizeCategorical,
  buildPositiveOutcomeMatcher,
  resolvePrivilegedGroup,
  applyRandomSampling
} = require("../utils/fairnessUtils");

const rate = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);

const computeConfusionMatrixByGroup = (rows, sensitiveAttr, isPositiveOutcome) => {
  const matrices = {};

  rows.forEach((row) => {
    const group = normalizeCategorical(row[sensitiveAttr]) || "unknown";
    const truthPositive = isPositiveOutcome(row.groundTruth);
    const predictionPositive = isPositiveOutcome(row.prediction);

    if (!matrices[group]) {
      matrices[group] = { TP: 0, FP: 0, TN: 0, FN: 0, total: 0 };
    }

    if (truthPositive && predictionPositive) matrices[group].TP += 1;
    else if (!truthPositive && predictionPositive) matrices[group].FP += 1;
    else if (!truthPositive && !predictionPositive) matrices[group].TN += 1;
    else matrices[group].FN += 1;
    matrices[group].total += 1;
  });

  return matrices;
};

const computeFalsePositiveRate = (matrix) => rate(matrix.FP, matrix.FP + matrix.TN);

const computeFalseNegativeRate = (matrix) => rate(matrix.FN, matrix.FN + matrix.TP);

const computeTruePositiveRate = (matrix) => rate(matrix.TP, matrix.TP + matrix.FN);

const computePrecision = (matrix) => rate(matrix.TP, matrix.TP + matrix.FP);

const maxPairwiseDifference = (valuesByGroup) => {
  const groups = Object.keys(valuesByGroup);
  let maxDiff = 0;
  const pairwise = [];
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const diff = Math.abs((valuesByGroup[groups[i]] ?? 0) - (valuesByGroup[groups[j]] ?? 0));
      maxDiff = Math.max(maxDiff, diff);
      pairwise.push({
        group_a: groups[i],
        group_b: groups[j],
        absolute_difference: Number(diff.toFixed(4))
      });
    }
  }
  return { maxDifference: Number(maxDiff.toFixed(4)), pairwise };
};

const computeEqualOpportunityDifference = (tprByGroup) => maxPairwiseDifference(tprByGroup);

const computePredictiveParity = (precisionByGroup) => maxPairwiseDifference(precisionByGroup);

const computeGroupAccuracy = (matrix) => rate(matrix.TP + matrix.TN, matrix.total);

const computeModelBiasScore = ({ fprDisparity, fnrDisparity, equalOpportunityDifference }) => {
  // Interpretable weighted score in [0,1]:
  // FPR disparity (35%) + FNR disparity (35%) + Equal Opportunity disparity (30%).
  // Higher values mean higher unfairness in error profiles across sensitive groups.
  const score =
    0.35 * (fprDisparity ?? 0) +
    0.35 * (fnrDisparity ?? 0) +
    0.3 * (equalOpportunityDifference ?? 0);
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
};

const riskLevelFromScore = (score) => {
  if (score >= 0.66) return "HIGH";
  if (score >= 0.33) return "MEDIUM";
  return "LOW";
};

const validateEvaluationInput = (payload) => {
  const { predictions, groundTruth, features, sensitiveAttributes } = payload;
  if (!Array.isArray(predictions) || !Array.isArray(groundTruth)) {
    throw new AppError("predictions and groundTruth must be arrays", 400);
  }
  if (!predictions.length || !groundTruth.length) {
    throw new AppError("predictions and groundTruth cannot be empty", 400);
  }
  if (predictions.length !== groundTruth.length) {
    throw new AppError("predictions and groundTruth must have the same length", 400);
  }
  if (!Array.isArray(sensitiveAttributes) || !sensitiveAttributes.length) {
    throw new AppError("sensitiveAttributes must be a non-empty array", 400);
  }
  if (!Array.isArray(features) || !features.length) {
    throw new AppError("features must be provided as an array of objects for fairness grouping", 400);
  }
  if (features.length !== predictions.length) {
    throw new AppError("features must have the same length as predictions", 400);
  }

  const nonObjectFeature = features.find((feature) => !feature || typeof feature !== "object" || Array.isArray(feature));
  if (nonObjectFeature) {
    throw new AppError("Each item in features must be an object", 400);
  }

  const featureColumns = Object.keys(features[0] || {});
  const missingSensitive = sensitiveAttributes.filter((attr) => !featureColumns.includes(attr));
  if (missingSensitive.length) {
    throw new AppError(`Sensitive attributes not found in features: ${missingSensitive.join(", ")}`, 400);
  }

  return featureColumns;
};

const buildRows = ({ predictions, groundTruth, features }) =>
  predictions.map((prediction, index) => ({
    prediction,
    groundTruth: groundTruth[index],
    ...(features[index] || {})
  }));

const evaluateModelFairness = async ({
  predictions,
  groundTruth,
  features,
  sensitiveAttributes,
  positiveOutcome,
  privilegedGroup = {},
  maxSamples = 10000
}) => {
  validateEvaluationInput({ predictions, groundTruth, features, sensitiveAttributes });

  const rows = buildRows({ predictions, groundTruth, features });
  const sampling = applyRandomSampling(rows, maxSamples);
  const workingRows = sampling.rows;

  const outcomeValues = [...workingRows.map((row) => row.prediction), ...workingRows.map((row) => row.groundTruth)];
  const isPositiveOutcome = buildPositiveOutcomeMatcher(outcomeValues, positiveOutcome, "predictions/groundTruth");

  const confusionMatrices = {};
  const fairnessMetrics = {
    fpr_by_group: {},
    fnr_by_group: {},
    equal_opportunity_difference: {},
    predictive_parity: {}
  };
  const accuracyMetrics = {
    overall_accuracy: 0,
    group_accuracy: {}
  };
  const fairnessVsAccuracy = {
    overall_accuracy: 0,
    group_accuracies: {},
    disparity_score: 0
  };
  const privilegedGroupUsed = {};

  let totalTP = 0;
  let totalTN = 0;
  let totalCount = 0;

  sensitiveAttributes.forEach((sensitiveAttr) => {
    const matricesByGroup = computeConfusionMatrixByGroup(workingRows, sensitiveAttr, isPositiveOutcome);
    confusionMatrices[sensitiveAttr] = matricesByGroup;

    const fprByGroup = {};
    const fnrByGroup = {};
    const tprByGroup = {};
    const precisionByGroup = {};
    const groupAccuracies = {};

    Object.entries(matricesByGroup).forEach(([group, matrix]) => {
      fprByGroup[group] = Number(computeFalsePositiveRate(matrix).toFixed(4));
      fnrByGroup[group] = Number(computeFalseNegativeRate(matrix).toFixed(4));
      tprByGroup[group] = Number(computeTruePositiveRate(matrix).toFixed(4));
      precisionByGroup[group] = Number(computePrecision(matrix).toFixed(4));
      groupAccuracies[group] = Number(computeGroupAccuracy(matrix).toFixed(4));

      totalTP += matrix.TP;
      totalTN += matrix.TN;
      totalCount += matrix.total;
    });

    const eoDiff = computeEqualOpportunityDifference(tprByGroup);
    const predictiveParity = computePredictiveParity(precisionByGroup);
    const fprDiff = maxPairwiseDifference(fprByGroup);
    const fnrDiff = maxPairwiseDifference(fnrByGroup);
    const accuracyDiff = maxPairwiseDifference(groupAccuracies);

    const privileged = resolvePrivilegedGroup(
      Object.fromEntries(
        Object.entries(tprByGroup).map(([group, tpr]) => [group, { rate: tpr }])
      ),
      privilegedGroup[sensitiveAttr]
    );
    privilegedGroupUsed[sensitiveAttr] = {
      group: privileged.privilegedGroup,
      selection_method: privileged.selectionMethod
    };

    fairnessMetrics.fpr_by_group[sensitiveAttr] = fprByGroup;
    fairnessMetrics.fnr_by_group[sensitiveAttr] = fnrByGroup;
    fairnessMetrics.equal_opportunity_difference[sensitiveAttr] = {
      tpr_by_group: tprByGroup,
      max_difference: eoDiff.maxDifference
    };
    fairnessMetrics.predictive_parity[sensitiveAttr] = {
      precision_by_group: precisionByGroup,
      max_difference: predictiveParity.maxDifference
    };

    accuracyMetrics.group_accuracy[sensitiveAttr] = groupAccuracies;
    fairnessVsAccuracy.group_accuracies[sensitiveAttr] = groupAccuracies;
    fairnessVsAccuracy.disparity_score = Math.max(fairnessVsAccuracy.disparity_score, accuracyDiff.maxDifference);

    fairnessMetrics.fpr_by_group[sensitiveAttr]._max_difference = fprDiff.maxDifference;
    fairnessMetrics.fnr_by_group[sensitiveAttr]._max_difference = fnrDiff.maxDifference;
  });

  const overallAccuracy = totalCount > 0 ? Number(((totalTP + totalTN) / totalCount).toFixed(4)) : 0;
  accuracyMetrics.overall_accuracy = overallAccuracy;
  fairnessVsAccuracy.overall_accuracy = overallAccuracy;
  fairnessVsAccuracy.disparity_score = Number(fairnessVsAccuracy.disparity_score.toFixed(4));

  const fprDisparity = Math.max(
    ...Object.values(fairnessMetrics.fpr_by_group).map((entry) => entry._max_difference || 0)
  );
  const fnrDisparity = Math.max(
    ...Object.values(fairnessMetrics.fnr_by_group).map((entry) => entry._max_difference || 0)
  );
  const equalOpportunityDifference = Math.max(
    ...Object.values(fairnessMetrics.equal_opportunity_difference).map((entry) => entry.max_difference || 0)
  );

  const biasScore = computeModelBiasScore({
    fprDisparity,
    fnrDisparity,
    equalOpportunityDifference
  });
  const riskLevel = riskLevelFromScore(biasScore);

  Object.values(fairnessMetrics.fpr_by_group).forEach((entry) => delete entry._max_difference);
  Object.values(fairnessMetrics.fnr_by_group).forEach((entry) => delete entry._max_difference);

  return {
    summary: {
      total_samples: sampling.sampledSize,
      sampled: sampling.sampled,
      original_samples: sampling.originalSize
    },
    confusion_matrices: confusionMatrices,
    fairness_metrics: fairnessMetrics,
    accuracy_metrics: accuracyMetrics,
    fairness_vs_accuracy: fairnessVsAccuracy,
    bias_score: biasScore,
    risk_level: riskLevel,
    assumptions: {
      privileged_group_used: privilegedGroupUsed,
      sampling_applied: sampling.sampled
    }
  };
};

const saveModelAuditLog = async ({ result, metadata }) => {
  if (mongoose.connection.readyState !== 1) {
    if (env.dbRequired) {
      throw new Error("Database is required but not connected");
    }
    return { logId: null, skipped: true };
  }

  const document = await ModelAuditLog.create({
    action: "model_fairness_evaluation",
    targetType: "model",
    targetId: metadata?.targetId || "model-evaluator",
    details: {
      metrics: result.fairness_metrics,
      accuracy_metrics: result.accuracy_metrics,
      fairness_vs_accuracy: result.fairness_vs_accuracy,
      bias_score: result.bias_score,
      risk_level: result.risk_level,
      metadata: {
        input_size: metadata?.inputSize || result.summary.original_samples,
        sampled: result.summary.sampled,
        sampled_size: result.summary.total_samples
      },
      evaluated_at: new Date().toISOString()
    }
  });

  return { logId: document._id, skipped: false };
};

module.exports = {
  evaluateModelFairness,
  saveModelAuditLog,
  computeConfusionMatrixByGroup,
  computeFalsePositiveRate,
  computeFalseNegativeRate,
  computeEqualOpportunityDifference,
  computePredictiveParity,
  computeModelBiasScore
};
