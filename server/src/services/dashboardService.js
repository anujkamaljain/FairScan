const mongoose = require("mongoose");
const ModelAuditLog = require("../models/ModelAuditLog");
const BiasReport = require("../models/BiasReport");
const Dataset = require("../models/Dataset");
const env = require("../config/env");

const scoreToRiskLevel = (score) => {
  if (score >= 0.66) return "HIGH";
  if (score >= 0.33) return "MEDIUM";
  return "LOW";
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildFallbackSummary = () => ({
  overall_bias_score: 0,
  overall_risk_level: "LOW",
  model_risk_summary: [],
  dataset_risk_summary: [],
  last_applied_fix: null
});

const getDashboardSummary = async ({ actorId } = {}) => {
  if (!actorId) {
    return buildFallbackSummary();
  }

  if (mongoose.connection.readyState !== 1) {
    if (env.dbRequired) {
      throw new Error("Database is required but not connected");
    }
    return buildFallbackSummary();
  }

  const ownedDatasets = await Dataset.find({ ownerId: actorId }).select({ _id: 1 }).lean();
  const ownedDatasetIds = ownedDatasets.map((item) => item._id);

  const [datasetReports, modelLogs, latestMitigation] = await Promise.all([
    BiasReport.find({
      status: "completed",
      $or: [{ generatedBy: actorId }, { datasetId: { $in: ownedDatasetIds } }]
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    ModelAuditLog.find({ action: "model_fairness_evaluation", actorId }).sort({ createdAt: -1 }).limit(6).lean(),
    ModelAuditLog.findOne({ action: "bias_mitigation_run", actorId }).sort({ createdAt: -1 }).lean()
  ]);

  const datasetIdSet = new Set(datasetReports.map((report) => String(report.datasetId)));
  const datasets = await Dataset.find({ _id: { $in: [...datasetIdSet] } })
    .select({ _id: 1, name: 1 })
    .lean();
  const datasetNameById = Object.fromEntries(datasets.map((item) => [String(item._id), item.name]));

  const modelRiskSummary = modelLogs.map((log, index) => ({
    id: String(log._id),
    model: log.targetId || `model-${index + 1}`,
    bias_score: toSafeNumber(log?.details?.bias_score, 0),
    risk_level: log?.details?.risk_level || "LOW",
    timestamp: log.createdAt
  }));

  const datasetRiskSummary = datasetReports.map((report) => ({
    id: String(report._id),
    dataset: datasetNameById[String(report.datasetId)] || "Dataset",
    bias_score: toSafeNumber(report.biasScore, 0),
    risk_level: report.riskLevel || "LOW",
    timestamp: report.createdAt
  }));

  const scores = [
    ...modelRiskSummary.map((item) => item.bias_score),
    ...datasetRiskSummary.map((item) => item.bias_score)
  ];
  const overallBiasScore = scores.length
    ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(4))
    : 0;
  const overallRiskLevel = scoreToRiskLevel(overallBiasScore);

  const latestFixResult = latestMitigation?.details?.result;
  const percentageChange = toSafeNumber(latestFixResult?.improvement?.percentage_change, 0);
  const delta = toSafeNumber(latestFixResult?.improvement?.delta, 0);
  const effectiveness =
    percentageChange >= 12 ? "HIGH" : percentageChange >= 4 ? "MODERATE" : "LOW";

  return {
    overall_bias_score: overallBiasScore,
    overall_risk_level: overallRiskLevel,
    model_risk_summary: modelRiskSummary,
    dataset_risk_summary: datasetRiskSummary,
    last_applied_fix: latestMitigation
      ? {
          fix_type: latestMitigation?.details?.fixType || "UNKNOWN",
          description: latestFixResult?.applied_fix?.description || "Bias mitigation run completed",
          before_score: toSafeNumber(latestFixResult?.before?.bias_score, 0),
          after_score: toSafeNumber(latestFixResult?.after?.bias_score, 0),
          improvement_percentage: percentageChange,
          delta,
          effectiveness,
          no_significant_improvement: delta <= 0,
          timestamp: latestMitigation.createdAt
        }
      : null
  };
};

module.exports = {
  getDashboardSummary
};
