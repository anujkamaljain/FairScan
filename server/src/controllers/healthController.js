const { sendSuccess } = require("../utils/apiResponse");
const { getHealthStatus } = require("../services/healthService");

const getHealth = (req, res) => {
  const health = getHealthStatus();
  return sendSuccess(res, health, "Service is healthy");
};

module.exports = {
  getHealth
};
