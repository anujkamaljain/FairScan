const mongoose = require("mongoose");

const DB_STATES = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

const getHealthStatus = () => {
  const dbState = mongoose.connection.readyState;
  return {
    status: dbState === 1 ? "ok" : "degraded",
    service: "fairscan-api",
    database: DB_STATES[dbState] || "unknown",
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  getHealthStatus
};
