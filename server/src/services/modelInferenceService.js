const AppError = require("../utils/appError");
const { normalizeCategorical } = require("../utils/fairnessUtils");
const env = require("../config/env");
const logger = require("../config/logger");

const toNumericSignal = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.tanh(value / 1000);
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return Math.tanh(asNumber / 1000);
  }
  const text = String(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash + text.charCodeAt(index) * (index + 1)) % 1000;
  }
  return (hash % 200) / 100 - 1;
};

const sigmoid = (value) => 1 / (1 + Math.exp(-value));

const predictWithMockModel = (inputData) => {
  const entries = Object.entries(inputData || {}).sort(([a], [b]) => a.localeCompare(b));
  let weightedSum = 0;

  entries.forEach(([key, value], index) => {
    const signal = toNumericSignal(value);
    const normalizedSignal = signal;
    weightedSum += normalizedSignal * (0.15 + (index % 5) * 0.05);
    if (normalizeCategorical(key).includes("risk")) {
      weightedSum -= 0.25;
    }
  });

  const score = sigmoid(weightedSum);
  return {
    prediction: score >= 0.5 ? "approved" : "rejected",
    confidence: Number(score.toFixed(4)),
    model_type: "mock"
  };
};

const predictWithVertexModel = async (inputData, config) => {
  const timeoutMs = Number(config.timeoutMs || env.mlServiceTimeoutMs || 4000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${env.mlServiceUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputData }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`ML service error (${response.status})`);
    }

    const payload = await response.json();
    const prediction = payload?.prediction;
    const confidence = Number(payload?.confidence);
    if (!prediction || !Number.isFinite(confidence)) {
      throw new Error("ML service returned invalid response shape");
    }

    return {
      prediction: String(prediction),
      confidence: Number(confidence.toFixed(4)),
      model_type: "vertex"
    };
  } catch (error) {
    logger.warn("Vertex inference call failed", {
      error: error.message,
      fallbackEnabled: env.mlAllowMockFallback
    });

    if (!env.mlAllowMockFallback) {
      throw new AppError("Vertex inference is temporarily unavailable. Please retry.", 503);
    }

    return {
      ...predictWithMockModel(inputData),
      model_type: "mock-fallback"
    };
  } finally {
    clearTimeout(timeout);
  }
};

const predict = async (inputData, config = {}) => {
  const type = config.type || "mock";
  if (!inputData || typeof inputData !== "object" || Array.isArray(inputData)) {
    throw new AppError("inputData must be a non-empty object", 400);
  }

  if (type === "mock") {
    return predictWithMockModel(inputData);
  }
  if (type === "vertex") {
    return predictWithVertexModel(inputData, config);
  }

  throw new AppError(`Unsupported modelConfig.type '${type}'`, 400);
};

module.exports = {
  predict
};
