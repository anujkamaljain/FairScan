const { sendSuccess } = require("../utils/apiResponse");
const { applyBiasFix, autoFixBias, getFixedDatasetDownload } = require("../services/biasMitigationService");

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

const autoFix = async (req, res) => {
  const { datasetId, config = {} } = req.body || {};
  const result = await autoFixBias({
    datasetId,
    config,
    actorId: req.user?.sub || req.user?.id || null
  });
  return sendSuccess(res, result, "Auto-bias correction completed", 200);
};

const downloadFixedDataset = async (req, res) => {
  const { datasetId } = req.params;
  const payload = await getFixedDatasetDownload({
    datasetId,
    actorId: req.user?.sub || req.user?.id || null
  });

  const safeName = String(payload.fileName || "fixed-dataset.csv").replace(/"/g, "");
  res.setHeader("Content-Type", payload.contentType || "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  return res.status(200).send(payload.buffer);
};

module.exports = {
  applyFix,
  autoFix,
  downloadFixedDataset
};
