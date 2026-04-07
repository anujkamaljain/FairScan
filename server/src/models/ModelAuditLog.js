const mongoose = require("mongoose");

const modelAuditLogSchema = new mongoose.Schema(
  {
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiasReport"
    },
    action: {
      type: String,
      required: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    targetType: {
      type: String,
      enum: ["model", "dataset", "report", "system"],
      required: true
    },
    targetId: {
      type: String,
      required: true
    },
    details: {
      type: Map,
      of: String,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ModelAuditLog", modelAuditLogSchema);
