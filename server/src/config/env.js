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

const datasetStorageProvider = (process.env.DATASET_STORAGE_PROVIDER || "local").toLowerCase();
if (!["local", "gcs"].includes(datasetStorageProvider)) {
  throw new Error("DATASET_STORAGE_PROVIDER must be either 'local' or 'gcs'");
}

if (isProd && datasetStorageProvider === "gcs" && !process.env.GCS_BUCKET_NAME) {
  throw new Error("GCS_BUCKET_NAME must be set when DATASET_STORAGE_PROVIDER=gcs");
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
  // Default 45s: 12s was too aggressive under load (Gemini often slower than Vertex REST timeout).
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 45000,
  geminiAlertWebhookUrl: process.env.GEMINI_ALERT_WEBHOOK_URL || "",
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  datasetStorageProvider,
  gcsProjectId: process.env.GCS_PROJECT_ID || "",
  gcsBucketName: process.env.GCS_BUCKET_NAME || "",
  gcsKeyFilename: process.env.GCS_KEY_FILENAME || "",
  gcsDatasetPrefix: process.env.GCS_DATASET_PREFIX || "datasets",
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60000,
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  apiRateLimitWindowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60000,
  apiRateLimitMax: Number(process.env.API_RATE_LIMIT_MAX) || 120,
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  mlServiceTimeoutMs: Number(process.env.ML_SERVICE_TIMEOUT_MS) || 4000,
  mlAllowMockFallback:
    process.env.ML_ALLOW_MOCK_FALLBACK === undefined
      ? !isProd
      : process.env.ML_ALLOW_MOCK_FALLBACK === "true"
};

module.exports = env;
