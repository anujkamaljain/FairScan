const AppError = require("./appError");

const POSITIVE_TOKENS = new Set(["1", "true", "yes", "y", "approved", "accept", "positive", "pass"]);
const NEGATIVE_TOKENS = new Set(["0", "false", "no", "n", "rejected", "reject", "negative", "fail"]);

const normalizeCategorical = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text.toLowerCase() : null;
};

const uniqueNonEmptyValues = (values) => {
  const unique = new Set();
  values.forEach((value) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      unique.add(String(value).trim());
    }
  });
  return [...unique];
};

const buildPositiveOutcomeMatcher = (values, positiveOutcome, context = "target") => {
  const uniqueValues = uniqueNonEmptyValues(values);
  if (uniqueValues.length < 2) {
    throw new AppError(`${context} must contain at least two non-empty classes`, 400);
  }

  if (positiveOutcome !== undefined && positiveOutcome !== null && String(positiveOutcome).trim() !== "") {
    const normalizedPositive = normalizeCategorical(positiveOutcome);
    return (value) => normalizeCategorical(value) === normalizedPositive;
  }

  const normalizedValues = uniqueValues.map((value) => normalizeCategorical(value));
  const allBinaryLike = normalizedValues.every(
    (value) => POSITIVE_TOKENS.has(value) || NEGATIVE_TOKENS.has(value)
  );

  if (!allBinaryLike) {
    throw new AppError(`${context} is not binary-like. Please provide 'positiveOutcome' explicitly.`, 400);
  }

  return (value) => POSITIVE_TOKENS.has(normalizeCategorical(value));
};

const resolvePrivilegedGroup = (groupStats, explicitPrivilegedGroup) => {
  const groups = Object.keys(groupStats);
  if (groups.length < 2) {
    throw new AppError("Sensitive attribute must contain at least two groups", 400);
  }

  if (explicitPrivilegedGroup) {
    const normalized = normalizeCategorical(explicitPrivilegedGroup);
    if (!groupStats[normalized]) {
      throw new AppError(`Provided privileged group '${explicitPrivilegedGroup}' does not exist in data`, 400);
    }
    return {
      privilegedGroup: normalized,
      selectionMethod: "provided"
    };
  }

  const ranked = groups
    .map((group) => ({ group, rate: groupStats[group].rate ?? 0 }))
    .sort((a, b) => b.rate - a.rate);

  return {
    privilegedGroup: ranked[0].group,
    selectionMethod: "auto_highest_positive_rate"
  };
};

const applyRandomSampling = (rows, maxRows = 10000) => {
  if (!Array.isArray(rows) || rows.length <= maxRows) {
    return {
      rows,
      sampled: false,
      originalSize: rows.length,
      sampledSize: rows.length,
      maxRows
    };
  }

  // Fisher-Yates shuffle over indexes; keeps sampling unbiased without loading extra structures.
  const indexes = rows.map((_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  const sampledIndexes = indexes.slice(0, maxRows);
  const sampledRows = sampledIndexes.map((index) => rows[index]);

  return {
    rows: sampledRows,
    sampled: true,
    originalSize: rows.length,
    sampledSize: sampledRows.length,
    maxRows
  };
};

module.exports = {
  normalizeCategorical,
  buildPositiveOutcomeMatcher,
  resolvePrivilegedGroup,
  applyRandomSampling
};
