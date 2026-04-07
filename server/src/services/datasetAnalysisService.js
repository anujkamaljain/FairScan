const fs = require("fs/promises");
const mongoose = require("mongoose");
const Dataset = require("../models/Dataset");
const BiasReport = require("../models/BiasReport");
const { parseDatasetFile } = require("./datasetIngestionService");
const { analyzeBias } = require("./biasAnalysisService");
const { isGcsEnabled, uploadDatasetFileToGcs } = require("./gcsStorageService");
const logger = require("../config/logger");
const env = require("../config/env");

const saveAnalysisRecords = async ({ file, ingestion, analysis, targetColumn, sensitiveAttributes }) => {
  if (mongoose.connection.readyState !== 1) {
    if (env.dbRequired) {
      throw new Error("Database is required but not connected");
    }
    return { datasetId: null, reportId: null, persistenceSkipped: true };
  }

  let fileStorage = {
    provider: "local",
    sizeBytes: Number(file.size || 0),
    uploadedAt: new Date()
  };

  if (isGcsEnabled()) {
    const gcsMetadata = await uploadDatasetFileToGcs(file);
    fileStorage = gcsMetadata;
  }

  const datasetDoc = await Dataset.create({
    name: file.originalname,
    sourceType: "upload",
    status: "ready",
    rowCount: ingestion.summary.rows,
    metadata: {
      columns: ingestion.columns,
      missing_values: ingestion.summary.missing_values,
      mixed_type_columns: ingestion.summary.mixed_type_columns,
      analysis_context: {
        target_column: targetColumn,
        sensitive_attributes: sensitiveAttributes
      }
    },
    fileName: file.filename,
    fileType: file.mimetype || "unknown",
    fileStorage,
    dataSnapshot: ingestion.rows
  });

  const reportDoc = await BiasReport.create({
    datasetId: datasetDoc._id,
    status: "completed",
    metrics: analysis.bias_metrics,
    groupDistributions: analysis.group_distributions,
    flaggedFeatures: analysis.flagged_features.map((feature) => ({
      feature: feature.feature,
      sensitiveAttribute: feature.sensitive_attribute,
      correlation: feature.correlation,
      risk: feature.risk
    })),
    biasScore: analysis.bias_score,
    riskLevel: analysis.risk_level,
    findings: JSON.stringify({
      target_column: targetColumn,
      sensitive_attributes: sensitiveAttributes
    })
  });

  return {
    datasetId: datasetDoc._id,
    reportId: reportDoc._id,
    persistenceSkipped: false
  };
};

const runDatasetAnalysis = async ({
  file,
  targetColumn,
  sensitiveAttributes,
  positiveOutcome,
  privilegedGroup = {}
}) => {
  const ingestion = await parseDatasetFile(file);
  const analysis = analyzeBias({
    dataset: ingestion.rows,
    columns: ingestion.columns,
    targetColumn,
    sensitiveAttributes,
    positiveOutcome,
    privilegedGroup
  });

  const persistence = await saveAnalysisRecords({
    file,
    ingestion,
    analysis,
    targetColumn,
    sensitiveAttributes
  });

  return {
    dataset_summary: ingestion.summary,
    ...analysis,
    persisted: {
      dataset_id: persistence.datasetId,
      bias_report_id: persistence.reportId,
      skipped: persistence.persistenceSkipped
    }
  };
};

const removeTemporaryFile = async (filePath) => {
  if (!filePath) {
    return;
  }
  try {
    await fs.unlink(filePath);
  } catch (error) {
    logger.warn("Failed to remove temporary file", { filePath, error: error.message });
  }
};

module.exports = {
  runDatasetAnalysis,
  removeTemporaryFile
};
