const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/appError");
const { predict } = require("../services/modelInferenceService");
const { evaluateRealtimeBias } = require("../services/realtimeBiasService");
const { listRecentRealtimeAuditLogs, persistRealtimeAuditLog } = require("../services/realtimeAuditService");
const { enqueueAuditLog, registerAuditProcessor } = require("../utils/auditQueue");

registerAuditProcessor(async (payload) => {
  await persistRealtimeAuditLog(payload);
});

const normalizePrediction = (prediction) => {
  if (!prediction || typeof prediction !== "object") {
    return { label: "rejected", score: 0 };
  }
  if (prediction.label !== undefined || prediction.score !== undefined) {
    return {
      label: prediction.label || "rejected",
      score: Number(prediction.score || 0)
    };
  }
  return {
    label: prediction.prediction || "rejected",
    score: Number(prediction.confidence || 0)
  };
};

const predictWithAudit = async (req, res) => {
  const body = req.body || {};
  const { inputData, sensitiveAttributes, outcomeField } = body;
  const modelConfig = { type: "vertex" };
  const actorId = req.user?.sub || req.user?.id || null;

  if (!inputData || typeof inputData !== "object" || Array.isArray(inputData)) {
    throw new AppError("inputData must be a non-empty object", 400);
  }
  if (!Array.isArray(sensitiveAttributes) || !sensitiveAttributes.length) {
    throw new AppError("sensitiveAttributes must be a non-empty array", 400);
  }

  const outcomeKey =
    outcomeField != null && String(outcomeField).trim() ? String(outcomeField).trim() : null;
  if (outcomeKey && !(outcomeKey in inputData)) {
    throw new AppError(
      `outcomeField "${outcomeKey}" is not a key in inputData. Leave it blank if your JSON has no label/outcome column.`,
      400
    );
  }

  const modelInput = { ...inputData };
  if (outcomeKey) {
    delete modelInput[outcomeKey];
  }

  const sensitiveFiltered = sensitiveAttributes
    .map((attr) => String(attr).trim())
    .filter(Boolean)
    .filter((attr) => attr !== outcomeKey);

  if (!sensitiveFiltered.length) {
    throw new AppError(
      "No sensitive attributes left for counterfactual tests after excluding the outcome field. List features to perturb (e.g. gender) separately from the outcome key.",
      400
    );
  }

  const inferencePrediction = await predict(modelInput, modelConfig);
  const prediction = normalizePrediction(inferencePrediction);
  const biasCheck = await evaluateRealtimeBias({
    inputData: modelInput,
    sensitiveAttributes: sensitiveFiltered,
    basePrediction: inferencePrediction,
    predictFn: predict,
    modelConfig
  });

  enqueueAuditLog({
    input: inputData,
    model_input: modelInput,
    outcome_field: outcomeKey,
    prediction,
    bias_risk: biasCheck.bias_risk,
    reason_code: biasCheck.reason_code,
    delta_score: biasCheck.delta_score,
    counterfactual_results: biasCheck.counterfactual_results,
    sensitive_attributes: sensitiveFiltered,
    modelType: modelConfig.type || "vertex",
    actorId,
    timestamp: new Date().toISOString()
  });

  return sendSuccess(
    res,
    {
      prediction,
      outcome_field: outcomeKey,
      bias_risk: biasCheck.bias_risk,
      reason_code: biasCheck.reason_code,
      explanation_hint: biasCheck.explanation_hint,
      delta_score: biasCheck.delta_score,
      counterfactual_results: biasCheck.counterfactual_results
    },
    "Prediction evaluated with realtime bias audit",
    200
  );
};

const getRecentRealtimeAuditLogs = async (req, res) => {
  const logs = await listRecentRealtimeAuditLogs({
    limit: 10,
    actorId: req.user?.sub || req.user?.id || null
  });
  return sendSuccess(res, { logs }, "Recent realtime audit logs fetched", 200);
};

module.exports = {
  predictWithAudit,
  getRecentRealtimeAuditLogs
};
