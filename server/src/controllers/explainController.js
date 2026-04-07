const { sendSuccess } = require("../utils/apiResponse");
const { explainPayload } = require("../services/explainabilityService");

const explainDataset = async (req, res) => {
  const result = await explainPayload(req.body || {});
  return sendSuccess(res, result, "Dataset explanation generated", 200);
};

const explainModel = async (req, res) => {
  const result = await explainPayload(req.body || {});
  return sendSuccess(res, result, "Model explanation generated", 200);
};

const explainRealtime = async (req, res) => {
  const result = await explainPayload(req.body || {});
  return sendSuccess(res, result, "Realtime explanation generated", 200);
};

module.exports = {
  explainDataset,
  explainModel,
  explainRealtime
};
