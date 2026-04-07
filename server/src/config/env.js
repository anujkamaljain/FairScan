const isProd = (process.env.NODE_ENV || "development") === "production";

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "replace-this-in-production")) {
  throw new Error("JWT_SECRET must be set to a strong secret in production");
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fairsight-ai",
  mongoTimeoutMs: Number(process.env.MONGO_TIMEOUT_MS) || 3000,
  dbRequired:
    process.env.DB_REQUIRED === "true" || (!process.env.DB_REQUIRED && isProd),
  jwtSecret: process.env.JWT_SECRET || "replace-this-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-pro",
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 12000,
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  mlServiceTimeoutMs: Number(process.env.ML_SERVICE_TIMEOUT_MS) || 4000
};

module.exports = env;
