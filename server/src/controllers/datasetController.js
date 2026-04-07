const AppError = require("../utils/appError");
const { sendSuccess } = require("../utils/apiResponse");
const { runDatasetAnalysis, removeTemporaryFile } = require("../services/datasetAnalysisService");

const parseSensitiveAttributes = (rawValue) => {
  if (!rawValue) {
    throw new AppError("sensitiveAttributes is required", 400);
  }

  if (Array.isArray(rawValue)) {
    const parsedArray = rawValue.map((item) => String(item).trim()).filter(Boolean);
    if (!parsedArray.length) {
      throw new AppError("sensitiveAttributes cannot be empty", 400);
    }
    return [...new Set(parsedArray)];
  }
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (trimmed.startsWith("[")) {
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (error) {
        throw new AppError("sensitiveAttributes must be valid JSON array text", 400);
      }
      if (!Array.isArray(parsed)) {
        throw new AppError("sensitiveAttributes must be an array", 400);
      }
      const normalized = parsed.map((item) => String(item).trim()).filter(Boolean);
      if (!normalized.length) {
        throw new AppError("sensitiveAttributes cannot be empty", 400);
      }
      return [...new Set(normalized)];
    }
    const normalized = trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!normalized.length) {
      throw new AppError("sensitiveAttributes cannot be empty", 400);
    }
    return [...new Set(normalized)];
  }

  throw new AppError("sensitiveAttributes must be an array or comma-separated string", 400);
};

const parsePrivilegedGroup = (rawValue) => {
  if (!rawValue) {
    return {};
  }
  if (typeof rawValue === "object" && !Array.isArray(rawValue)) {
    return rawValue;
  }
  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new AppError("privilegedGroup must be an object map", 400);
      }
      return parsed;
    } catch (error) {
      throw new AppError("privilegedGroup must be valid JSON object text", 400);
    }
  }
  throw new AppError("privilegedGroup must be an object map", 400);
};

const uploadAndAnalyzeDataset = async (req, res) => {
  const filePath = req.file?.path;
  try {
    const targetColumn = req.body.targetColumn;
    const sensitiveAttributes = parseSensitiveAttributes(req.body.sensitiveAttributes);
    const positiveOutcome = req.body.positiveOutcome;
    const privilegedGroup = parsePrivilegedGroup(req.body.privilegedGroup);

    const analysis = await runDatasetAnalysis({
      file: req.file,
      targetColumn,
      sensitiveAttributes,
      positiveOutcome,
      privilegedGroup,
      actorId: req.user?.sub || req.user?.id || null
    });

    return sendSuccess(res, analysis, "Dataset uploaded and analyzed successfully", 201);
  } finally {
    await removeTemporaryFile(filePath);
  }
};

module.exports = {
  uploadAndAnalyzeDataset
};
