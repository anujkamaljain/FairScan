const { sendSuccess } = require("../utils/apiResponse");
const { applyBiasFix } = require("../services/biasMitigationService");

const applyFix = async (req, res) => {
  const { datasetId, fixType, config = {} } = req.body || {};
  const result = await applyBiasFix({
    datasetId,
    fixType,
    config,
    actorId: req.user?.sub || req.user?.id || null
  });
  return sendSuccess(res, result, "Bias mitigation fix applied", 200);
};

module.exports = {
  applyFix
};
