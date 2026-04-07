const { sendSuccess } = require("../utils/apiResponse");
const { generateStructuredReport } = require("../services/explainabilityService");

const generateReport = async (req, res) => {
  const input = req.body || {};
  const report = await generateStructuredReport(input);
  return sendSuccess(
    res,
    {
      sections: {
        overview: report.overview || "Overview unavailable.",
        key_findings: report.key_findings || [],
        risk_assessment: report.risk_assessment || "Risk assessment unavailable.",
        recommendations: report.recommendations || []
      }
    },
    "Audit report generated",
    200
  );
};

module.exports = {
  generateReport
};
