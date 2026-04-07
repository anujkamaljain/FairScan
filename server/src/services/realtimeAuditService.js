const mongoose = require("mongoose");
const ModelAuditLog = require("../models/ModelAuditLog");
const env = require("../config/env");

const persistRealtimeAuditLog = async (payload) => {
  if (mongoose.connection.readyState !== 1) {
    if (env.dbRequired) {
      throw new Error("Database is required but not connected");
    }
    return null;
  }

  const document = await ModelAuditLog.create({
    action: "realtime_prediction_audit",
    targetType: "model",
    targetId: payload.modelType || "mock",
    details: payload
  });

  return document._id;
};

const listRecentRealtimeAuditLogs = async (limit = 10) => {
  if (mongoose.connection.readyState !== 1) {
    if (env.dbRequired) {
      throw new Error("Database is required but not connected");
    }
    return [];
  }

  const docs = await ModelAuditLog.find({ action: "realtime_prediction_audit" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    id: doc._id,
    createdAt: doc.createdAt,
    ...doc.details
  }));
};

module.exports = {
  persistRealtimeAuditLog,
  listRecentRealtimeAuditLogs
};
