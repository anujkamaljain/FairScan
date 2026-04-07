const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const Dataset = require("../models/Dataset");
const BiasReport = require("../models/BiasReport");
const ModelAuditLog = require("../models/ModelAuditLog");
const env = require("../config/env");
const { analyzeBias } = require("./biasAnalysisService");
const { parseDatasetBuffer } = require("./datasetIngestionService");
const { downloadDatasetFileFromGcs } = require("./gcsStorageService");
const { normalizeCategorical } = require("../utils/fairnessUtils");

const computeCompositeBiasScore = (analysis) => {
  // Composite score used only for mitigation comparison:
  // 80% fairness score + 20% proxy-feature penalty.
  const fairness = Number(analysis.bias_score || 0);
  const flaggedCount = Array.isArray(analysis.flagged_features) ? analysis.flagged_features.length : 0;
  const proxyPenalty = Math.min(1, flaggedCount / 5);
  return Number((0.8 * fairness + 0.2 * proxyPenalty).toFixed(4));
};

const getRiskLevel = (score) => {
  if (score >= 0.66) return "HIGH";
  if (score >= 0.33) return "MEDIUM";
  return "LOW";
};

const parseAnalysisContext = async (datasetDoc) => {
  const context = datasetDoc?.metadata?.analysis_context || {};
  if (context.target_column && Array.isArray(context.sensitive_attributes) && context.sensitive_attributes.length) {
    return {
      targetColumn: context.target_column,
      sensitiveAttributes: context.sensitive_attributes
    };
  }

  const latestReport = await BiasReport.findOne({ datasetId: datasetDoc._id }).sort({ createdAt: -1 }).lean();
  if (!latestReport?.findings) {
    throw new AppError("Unable to infer analysis context from dataset/report metadata", 400);
  }

  let parsed;
  try {
    parsed = JSON.parse(latestReport.findings);
  } catch {
    throw new AppError("Stored report findings are malformed", 400);
  }

  if (!parsed.target_column || !Array.isArray(parsed.sensitive_attributes) || !parsed.sensitive_attributes.length) {
    throw new AppError("Stored report findings missing target/sensitive context", 400);
  }

  return {
    targetColumn: parsed.target_column,
    sensitiveAttributes: parsed.sensitive_attributes
  };
};

const cloneRows = (rows) => rows.map((row) => ({ ...row }));

const loadDatasetRows = async (datasetDoc) => {
  if (Array.isArray(datasetDoc.dataSnapshot) && datasetDoc.dataSnapshot.length) {
    return cloneRows(datasetDoc.dataSnapshot);
  }

  if (datasetDoc.fileStorage?.provider === "gcs" && datasetDoc.fileStorage.objectPath) {
    const buffer = await downloadDatasetFileFromGcs(datasetDoc.fileStorage);
    const ingestion = await parseDatasetBuffer({
      buffer,
      originalname: datasetDoc.name || datasetDoc.fileName || "dataset.csv"
    });
    return ingestion.rows;
  }

  throw new AppError(
    "Dataset snapshot unavailable for mitigation. Re-upload dataset with current pipeline before applying fixes.",
    400
  );
};

const choosePrimarySensitiveAttribute = (sensitiveAttributes) => sensitiveAttributes[0];

const groupRowsByAttribute = (rows, sensitiveAttr) => {
  const grouped = {};
  rows.forEach((row) => {
    const key = normalizeCategorical(row[sensitiveAttr]) || "unknown";
    grouped[key] = grouped[key] || [];
    grouped[key].push(row);
  });
  return grouped;
};

const reweightRows = (rows, sensitiveAttr) => {
  const grouped = groupRowsByAttribute(rows, sensitiveAttr);
  const counts = Object.values(grouped).map((group) => group.length);
  const maxCount = Math.max(...counts);

  const output = [];
  Object.values(grouped).forEach((groupRows) => {
    output.push(...groupRows);
    const deficit = maxCount - groupRows.length;
    for (let i = 0; i < deficit; i += 1) {
      output.push({ ...groupRows[i % groupRows.length] });
    }
  });
  return output;
};

const balanceRows = (rows, sensitiveAttr, method = "oversample") => {
  const grouped = groupRowsByAttribute(rows, sensitiveAttr);
  const counts = Object.values(grouped).map((group) => group.length);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);

  const output = [];
  Object.values(grouped).forEach((groupRows) => {
    if (method === "undersample") {
      output.push(...groupRows.slice(0, minCount));
      return;
    }

    // Default deterministic oversampling.
    output.push(...groupRows);
    const deficit = maxCount - groupRows.length;
    for (let i = 0; i < deficit; i += 1) {
      output.push({ ...groupRows[i % groupRows.length] });
    }
  });
  return output;
};

const removeFeature = (rows, feature, targetColumn, sensitiveAttributes) => {
  if (!feature) {
    throw new AppError("config.feature is required for REMOVE_FEATURE", 400);
  }
  if (!rows[0] || !(feature in rows[0])) {
    throw new AppError(`Feature '${feature}' was not found in dataset`, 400);
  }
  if (feature === targetColumn) {
    throw new AppError(`Feature '${feature}' is the target column and cannot be removed`, 400);
  }
  if (sensitiveAttributes.includes(feature)) {
    throw new AppError(`Feature '${feature}' is sensitive and cannot be removed`, 400);
  }

  return rows.map((row) => {
    const copy = { ...row };
    delete copy[feature];
    return copy;
  });
};

const buildFixDescription = (fixType, config, primarySensitiveAttr) => {
  if (fixType === "REWEIGHT") {
    return `Applied deterministic reweighting by duplicating underrepresented '${primarySensitiveAttr}' groups.`;
  }
  if (fixType === "REMOVE_FEATURE") {
    return `Removed feature '${config.feature}' to reduce potential proxy influence.`;
  }
  return `Balanced '${primarySensitiveAttr}' groups using deterministic ${config.method || "oversample"} strategy.`;
};

const persistMitigationRun = async (payload) => {
  if (mongoose.connection.readyState !== 1) {
    if (env.dbRequired) {
      throw new Error("Database is required but not connected");
    }
    return null;
  }

  const doc = await ModelAuditLog.create({
    action: "bias_mitigation_run",
    targetType: "dataset",
    targetId: payload.datasetId,
    actorId: payload.actorId || null,
    details: payload
  });

  return doc._id;
};

const applyBiasFix = async ({ datasetId, fixType, config = {}, actorId = null }) => {
  if (!datasetId) {
    throw new AppError("datasetId is required", 400);
  }
  if (!actorId) {
    throw new AppError("Authenticated user context is required", 401);
  }
  if (!["REWEIGHT", "REMOVE_FEATURE", "BALANCE"].includes(fixType)) {
    throw new AppError("fixType must be one of REWEIGHT, REMOVE_FEATURE, BALANCE", 400);
  }

  const datasetDoc = await Dataset.findOne({ _id: datasetId, ownerId: actorId }).lean();
  if (!datasetDoc) {
    throw new AppError("Dataset not found", 404);
  }

  const { targetColumn, sensitiveAttributes } = await parseAnalysisContext(datasetDoc);
  const originalRows = await loadDatasetRows(datasetDoc);
  const originalColumns = Object.keys(originalRows[0] || {});

  const beforeAnalysis = analyzeBias({
    dataset: originalRows,
    columns: originalColumns,
    targetColumn,
    sensitiveAttributes,
    positiveOutcome: config.positiveOutcome
  });

  const primarySensitiveAttr = choosePrimarySensitiveAttribute(sensitiveAttributes);
  let mitigatedRows = cloneRows(originalRows);

  if (fixType === "REWEIGHT") {
    mitigatedRows = reweightRows(mitigatedRows, primarySensitiveAttr);
  } else if (fixType === "REMOVE_FEATURE") {
    mitigatedRows = removeFeature(mitigatedRows, config.feature, targetColumn, sensitiveAttributes);
  } else {
    const method = config.method === "undersample" ? "undersample" : "oversample";
    mitigatedRows = balanceRows(mitigatedRows, primarySensitiveAttr, method);
  }

  if (!mitigatedRows.length) {
    throw new AppError("Mitigation produced an empty dataset", 400);
  }

  const afterColumns = Object.keys(mitigatedRows[0]);
  const afterAnalysis = analyzeBias({
    dataset: mitigatedRows,
    columns: afterColumns,
    targetColumn,
    sensitiveAttributes,
    positiveOutcome: config.positiveOutcome
  });

  const beforeScore = computeCompositeBiasScore(beforeAnalysis);
  const afterScore = computeCompositeBiasScore(afterAnalysis);
  const delta = Number((beforeScore - afterScore).toFixed(4));
  const percentageChange =
    beforeScore > 0 ? Number((((beforeScore - afterScore) / beforeScore) * 100).toFixed(2)) : 0;

  const warning =
    delta < 0
      ? "Applied fix increased the composite bias score."
      : delta === 0
        ? "Applied fix produced no measurable improvement."
        : null;

  const appliedFix = {
    type: fixType,
    description: buildFixDescription(fixType, config, primarySensitiveAttr)
  };

  const response = {
    before: {
      bias_score: beforeScore,
      risk_level: getRiskLevel(beforeScore),
      fairness_bias_score: beforeAnalysis.bias_score
    },
    after: {
      bias_score: afterScore,
      risk_level: getRiskLevel(afterScore),
      fairness_bias_score: afterAnalysis.bias_score
    },
    improvement: {
      delta,
      percentage_change: percentageChange
    },
    applied_fix: appliedFix,
    warning,
    details: {
      before_metrics: beforeAnalysis.bias_metrics,
      after_metrics: afterAnalysis.bias_metrics,
      before_group_distributions: beforeAnalysis.group_distributions,
      after_group_distributions: afterAnalysis.group_distributions
    }
  };

  const logId = await persistMitigationRun({
    datasetId: String(datasetId),
    actorId,
    fixType,
    config,
    result: response
  });

  return {
    ...response,
    persisted: {
      model_audit_log_id: logId,
      skipped: !logId
    }
  };
};

module.exports = {
  applyBiasFix
};
