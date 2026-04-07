const getHealthStatus = () => {
  return {
    status: "ok",
    service: "fairsight-api",
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  getHealthStatus
};
