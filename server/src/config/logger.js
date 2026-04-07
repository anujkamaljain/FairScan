const { createLogger, format, transports } = require("winston");
const env = require("./env");

const logger = createLogger({
  level: env.nodeEnv === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: "fairsight-api" },
  transports: [new transports.Console()]
});

module.exports = logger;
