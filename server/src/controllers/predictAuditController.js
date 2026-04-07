const { sendSuccess } = require("../utils/apiResponse");
const { predict } = require("../services/modelInferenceService");
const { evaluateRealtimeBias } = require("../services/realtimeBiasService");
const { listRecentRealtimeAuditLogs, persistRealtimeAuditLog } = require("../services/realtimeAuditService");
const { enqueueAuditLog, registerAuditProcessor } = require("../utils/auditQueue");

registerAuditProcessor(async (payload) => {
  await persistRealtimeAuditLog(payload);
});

const predictWithAudit = async (req, res) => {
  const { inputData, sensitiveAttributes, modelConfig = { type: "mock" } } = req.body || {};

  const prediction = await predict(inputData, modelConfig);
  const biasCheck = await evaluateRealtimeBias({
    inputData,
    sensitiveAttributes,
    basePrediction: prediction,
    predictFn: predict,
    modelConfig
  });

  enqueueAuditLog({
    input: inputData,
    prediction,
    bias_risk: biasCheck.bias_risk,
    delta_score: biasCheck.delta_score,
    counterfactual_results: biasCheck.counterfactual_results,
    sensitive_attributes: sensitiveAttributes,
    modelType: modelConfig.type || "mock",
    timestamp: new Date().toISOString()
  });

  return sendSuccess(
    res,
    {
      prediction,
      bias_risk: biasCheck.bias_risk,
      explanation_hint: biasCheck.explanation_hint,
      delta_score: biasCheck.delta_score,
      counterfactual_results: biasCheck.counterfactual_results
    },
    "Prediction evaluated with realtime bias audit",
    200
  );
};

const getRecentRealtimeAuditLogs = async (req, res) => {
  const logs = await listRecentRealtimeAuditLogs(10);
  return sendSuccess(res, { logs }, "Recent realtime audit logs fetched", 200);
};

module.exports = {
  predictWithAudit,
  getRecentRealtimeAuditLogs
};
