const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fairsight-ai",
  mongoTimeoutMs: Number(process.env.MONGO_TIMEOUT_MS) || 3000,
  dbRequired:
    process.env.DB_REQUIRED === "true" ||
    (!process.env.DB_REQUIRED && (process.env.NODE_ENV || "development") === "production"),
  jwtSecret: process.env.JWT_SECRET || "replace-this-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d"
};

module.exports = env;
