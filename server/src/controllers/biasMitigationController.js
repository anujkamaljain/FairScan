const { sendSuccess } = require("../utils/apiResponse");
const { applyBiasFix } = require("../services/biasMitigationService");

const applyFix = async (req, res) => {
  const { datasetId, fixType, config = {} } = req.body || {};
  const result = await applyBiasFix({ datasetId, fixType, config });
  return sendSuccess(res, result, "Bias mitigation fix applied", 200);
};

module.exports = {
  applyFix
};
