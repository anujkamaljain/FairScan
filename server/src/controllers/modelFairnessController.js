const { sendSuccess } = require("../utils/apiResponse");
const { evaluateModelFairness, saveModelAuditLog } = require("../services/modelFairnessService");

const evaluateModel = async (req, res) => {
  const {
    predictions,
    groundTruth,
    features,
    sensitiveAttributes,
    positiveOutcome,
    privilegedGroup
  } = req.body;

  const result = await evaluateModelFairness({
    predictions,
    groundTruth,
    features,
    sensitiveAttributes,
    positiveOutcome,
    privilegedGroup
  });

  const audit = await saveModelAuditLog({
    result,
    metadata: {
      inputSize: Array.isArray(predictions) ? predictions.length : 0,
      actorId: req.user?.sub || req.user?.id || null
    }
  });

  return sendSuccess(
    res,
    {
      ...result,
      persisted: {
        model_audit_log_id: audit.logId,
        skipped: audit.skipped
      }
    },
    "Model fairness evaluation completed",
    200
  );
};

module.exports = {
  evaluateModel
};
