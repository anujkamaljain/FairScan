const { sendSuccess } = require("../utils/apiResponse");
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
  const { inputData, sensitiveAttributes, modelConfig = { type: "mock" } } = req.body || {};
  const actorId = req.user?.sub || req.user?.id || null;

  const inferencePrediction = await predict(inputData, modelConfig);
  const prediction = normalizePrediction(inferencePrediction);
  const biasCheck = await evaluateRealtimeBias({
    inputData,
    sensitiveAttributes,
    basePrediction: inferencePrediction,
    predictFn: predict,
    modelConfig
  });

  enqueueAuditLog({
    input: inputData,
    prediction,
    bias_risk: biasCheck.bias_risk,
    reason_code: biasCheck.reason_code,
    delta_score: biasCheck.delta_score,
    counterfactual_results: biasCheck.counterfactual_results,
    sensitive_attributes: sensitiveAttributes,
    modelType: modelConfig.type || "mock",
    actorId,
    timestamp: new Date().toISOString()
  });

  return sendSuccess(
    res,
    {
      prediction,
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
