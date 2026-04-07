const isProd = (process.env.NODE_ENV || "development") === "production";

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "replace-this-in-production")) {
  throw new Error("JWT_SECRET must be set to a strong secret in production");
}

if (isProd && !process.env.MONGO_URI) {
  throw new Error("MONGO_URI must be set in production");
}

if (isProd && !process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY must be set in production");
}

if (isProd && (!process.env.ML_SERVICE_URL || /localhost|127\.0\.0\.1/i.test(process.env.ML_SERVICE_URL))) {
  throw new Error("ML_SERVICE_URL must point to a non-local endpoint in production");
}

if (isProd && (!process.env.CORS_ORIGIN || /localhost|127\.0\.0\.1/i.test(process.env.CORS_ORIGIN))) {
  throw new Error("CORS_ORIGIN must be configured to production frontend origin(s)");
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
  geminiAlertWebhookUrl: process.env.GEMINI_ALERT_WEBHOOK_URL || "",
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  mlServiceTimeoutMs: Number(process.env.ML_SERVICE_TIMEOUT_MS) || 4000
};

module.exports = env;
