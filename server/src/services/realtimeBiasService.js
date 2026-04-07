const AppError = require("../utils/appError");
const { normalizeCategorical } = require("../utils/fairnessUtils");

const DEFAULT_ALTERNATIVES = {
  male: "female",
  female: "male",
  man: "woman",
  woman: "man",
  true: "false",
  false: "true",
  yes: "no",
  no: "yes"
};

const deriveCounterfactualValue = (value) => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "boolean") {
    return !value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value + 1;
  }

  const normalized = normalizeCategorical(value);
  if (DEFAULT_ALTERNATIVES[normalized] !== undefined) {
    return DEFAULT_ALTERNATIVES[normalized];
  }

  return `counterfactual_${String(value)}`;
};

const computeBiasRisk = ({ changedLabelCount, maxScoreDelta }) => {
  if (changedLabelCount > 0) {
    return "HIGH";
  }
  if (maxScoreDelta >= 0.1) {
    return "MEDIUM";
  }
  return "LOW";
};

const explanationForRisk = (risk) => {
  if (risk === "HIGH") {
    return "Sensitive attribute influenced outcome";
  }
  if (risk === "MEDIUM") {
    return "Sensitive attribute shifted prediction confidence";
  }
  return "No strong sensitivity impact detected";
};

const evaluateRealtimeBias = async ({
  inputData,
  sensitiveAttributes,
  basePrediction,
  predictFn,
  modelConfig
}) => {
  if (!Array.isArray(sensitiveAttributes) || !sensitiveAttributes.length) {
    throw new AppError("sensitiveAttributes must be a non-empty array", 400);
  }

  const missingAttributes = sensitiveAttributes.filter((attr) => !(attr in inputData));
  if (missingAttributes.length) {
    throw new AppError(`Sensitive attributes missing from inputData: ${missingAttributes.join(", ")}`, 400);
  }

  const counterfactualResults = [];
  let changedLabelCount = 0;
  let maxScoreDelta = 0;

  for (const attribute of sensitiveAttributes) {
    const originalValue = inputData[attribute];
    const counterfactualValue = deriveCounterfactualValue(originalValue);
    const scenarioInput = { ...inputData, [attribute]: counterfactualValue };
    const scenarioPrediction = await predictFn(scenarioInput, modelConfig);

    const deltaScore = Math.abs((scenarioPrediction.score ?? 0) - (basePrediction.score ?? 0));
    const labelChanged = scenarioPrediction.label !== basePrediction.label;
    if (labelChanged) {
      changedLabelCount += 1;
    }
    maxScoreDelta = Math.max(maxScoreDelta, deltaScore);

    counterfactualResults.push({
      sensitive_attribute: attribute,
      original_value: originalValue,
      counterfactual_value: counterfactualValue,
      original_prediction: basePrediction,
      counterfactual_prediction: scenarioPrediction,
      label_changed: labelChanged,
      score_delta: Number(deltaScore.toFixed(4))
    });
  }

  const biasRisk = computeBiasRisk({ changedLabelCount, maxScoreDelta });

  return {
    bias_risk: biasRisk,
    counterfactual_results: counterfactualResults,
    delta_score: Number(maxScoreDelta.toFixed(4)),
    explanation_hint: explanationForRisk(biasRisk)
  };
};

module.exports = {
  evaluateRealtimeBias
};
