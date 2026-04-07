const mongoose = require("mongoose");

const metricSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: Number, required: true },
    threshold: { type: Number }
  },
  { _id: false }
);

const flaggedFeatureSchema = new mongoose.Schema(
  {
    feature: { type: String, required: true },
    sensitiveAttribute: { type: String, required: true },
    correlation: { type: Number, required: true },
    risk: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], required: true }
  },
  { _id: false }
);

const biasReportSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      required: true
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    modelName: {
      type: String,
      default: "dataset-bias-analyzer-v1"
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued"
    },
    fairnessMetrics: {
      type: [metricSchema],
      default: []
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    groupDistributions: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    flaggedFeatures: {
      type: [flaggedFeatureSchema],
      default: []
    },
    biasScore: {
      type: Number,
      min: 0,
      max: 1
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"]
    },
    analyzedAt: {
      type: Date,
      default: Date.now
    },
    findings: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("BiasReport", biasReportSchema);
