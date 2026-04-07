const { sendSuccess } = require("../utils/apiResponse");
const { getDashboardSummary } = require("../services/dashboardService");

const getSummary = async (req, res) => {
  const summary = await getDashboardSummary();
  return sendSuccess(res, summary, "Dashboard summary fetched", 200);
};

module.exports = {
  getSummary
};
