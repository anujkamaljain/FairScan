const AppError = require("../utils/appError");
const { normalizeCategorical } = require("../utils/fairnessUtils");

const toNumericSignal = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  const text = String(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash + text.charCodeAt(index) * (index + 1)) % 1000;
  }
  return hash / 10;
};

const sigmoid = (value) => 1 / (1 + Math.exp(-value));

const predictWithMockModel = (inputData) => {
  const entries = Object.entries(inputData || {}).sort(([a], [b]) => a.localeCompare(b));
  let weightedSum = 0;

  entries.forEach(([key, value], index) => {
    const signal = toNumericSignal(value);
    const normalizedSignal = signal / 100;
    weightedSum += normalizedSignal * (index + 1);
    if (normalizeCategorical(key).includes("risk")) {
      weightedSum -= 0.25;
    }
  });

  const score = sigmoid(weightedSum - 1.5);
  return {
    label: score >= 0.5 ? "approved" : "rejected",
    score: Number(score.toFixed(4)),
    model_type: "mock"
  };
};

const predictWithVertexModel = async (inputData, config) => {
  // TODO: Integrate with the existing Vertex microservice endpoint.
  // Keep this inference boundary independent from bias logic.
  throw new AppError(
    "Vertex model inference is not wired in this API yet. Use modelConfig.type='mock' for now.",
    501
  );
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
