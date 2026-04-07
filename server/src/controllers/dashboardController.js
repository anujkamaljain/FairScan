const { sendSuccess } = require("../utils/apiResponse");
const { getDashboardSummary } = require("../services/dashboardService");

const getSummary = async (req, res) => {
  const summary = await getDashboardSummary({
    actorId: req.user?.sub || req.user?.id || null
  });
  return sendSuccess(res, summary, "Dashboard summary fetched", 200);
};

module.exports = {
  getSummary
};
