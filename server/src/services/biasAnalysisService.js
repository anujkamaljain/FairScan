const AppError = require("../utils/appError");
const {
  normalizeCategorical,
  buildPositiveOutcomeMatcher,
  resolvePrivilegedGroup,
  applyRandomSampling
} = require("../utils/fairnessUtils");

const parseNumeric = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const uniqueValues = (dataset, column) => {
  const values = new Set();
  dataset.forEach((row) => {
    const value = row[column];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      values.add(String(value).trim());
    }
  });
  return [...values];
};

const resolvePositiveOutcomeMatcher = (dataset, targetColumn, positiveOutcome) => {
  const targetValues = dataset.map((row) => row[targetColumn]);
  return buildPositiveOutcomeMatcher(targetValues, positiveOutcome, `Target column '${targetColumn}'`);
};

const prepareSensitiveAttributes = (dataset, sensitiveAttributes) => {
  if (!Array.isArray(sensitiveAttributes) || sensitiveAttributes.length === 0) {
    throw new AppError("sensitiveAttributes must be a non-empty array", 400);
  }

  const columns = Object.keys(dataset[0] || {});
  const missingAttributes = sensitiveAttributes.filter((attr) => !columns.includes(attr));
  if (missingAttributes.length) {
    throw new AppError(`Sensitive attributes not found in dataset: ${missingAttributes.join(", ")}`, 400);
  }
};

const getGroupStats = (dataset, targetColumn, sensitiveAttr, isPositiveOutcome) => {
  const groupStats = new Map();

  dataset.forEach((row) => {
    const group = normalizeCategorical(row[sensitiveAttr]) || "unknown";
    const targetValue = row[targetColumn];

    if (targetValue === null || targetValue === undefined || String(targetValue).trim() === "") {
      return;
    }

    if (!groupStats.has(group)) {
      groupStats.set(group, { total: 0, positive: 0 });
    }

    const stats = groupStats.get(group);
    stats.total += 1;
    if (isPositiveOutcome(targetValue)) {
      stats.positive += 1;
    }
  });

  const rates = {};
  for (const [group, stats] of groupStats.entries()) {
    rates[group] = {
      total: stats.total,
      positive: stats.positive,
      rate: stats.total > 0 ? stats.positive / stats.total : null
    };
  }
  return rates;
};

const computeDemographicParity = (dataset, targetColumn, sensitiveAttr, positiveOutcome) => {
  const isPositiveOutcome = resolvePositiveOutcomeMatcher(dataset, targetColumn, positiveOutcome);
  const groupRates = getGroupStats(dataset, targetColumn, sensitiveAttr, isPositiveOutcome);
  const groups = Object.keys(groupRates);
  if (groups.length < 2) {
    throw new AppError(
      `Sensitive attribute '${sensitiveAttr}' must contain at least two groups for demographic parity`,
      400
    );
  }

  let maxGap = 0;
  const pairwiseDifferences = [];
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const groupA = groups[i];
      const groupB = groups[j];
      const rateA = groupRates[groupA].rate;
      const rateB = groupRates[groupB].rate;
      const difference = rateA - rateB;
      const absoluteDifference = Math.abs(difference);
      maxGap = Math.max(maxGap, absoluteDifference);

      pairwiseDifferences.push({
        group_a: groupA,
        group_b: groupB,
        difference,
        absolute_difference: absoluteDifference
      });
    }
  }

  return {
    sensitive_attribute: sensitiveAttr,
    group_rates: groupRates,
    pairwise_differences: pairwiseDifferences,
    max_gap: maxGap
  };
};

const computeDisparateImpact = (dataset, targetColumn, sensitiveAttr, positiveOutcome, explicitPrivilegedGroup) => {
  const isPositiveOutcome = resolvePositiveOutcomeMatcher(dataset, targetColumn, positiveOutcome);
  const groupRates = getGroupStats(dataset, targetColumn, sensitiveAttr, isPositiveOutcome);
  const groups = Object.keys(groupRates);
  if (groups.length < 2) {
    throw new AppError(
      `Sensitive attribute '${sensitiveAttr}' must contain at least two groups for disparate impact`,
      400
    );
  }

  const { privilegedGroup, selectionMethod } = resolvePrivilegedGroup(groupRates, explicitPrivilegedGroup);
  const privileged = {
    group: privilegedGroup,
    rate: groupRates[privilegedGroup].rate
  };
  const unprivilegedCandidates = groups
    .filter((group) => group !== privileged.group)
    .map((group) => ({ group, rate: groupRates[group].rate }))
    .sort((a, b) => a.rate - b.rate);
  const unprivileged = unprivilegedCandidates[0];
  const ratio = privileged.rate > 0 ? unprivileged.rate / privileged.rate : null;

  return {
    sensitive_attribute: sensitiveAttr,
    privileged_group: privileged.group,
    unprivileged_group: unprivileged.group,
    privileged_rate: privileged.rate,
    unprivileged_rate: unprivileged.rate,
    ratio,
    privileged_selection_method: selectionMethod
  };
};

const groupOutcomeDistribution = (dataset, targetColumn, sensitiveAttr, positiveOutcome) => {
  const isPositiveOutcome = resolvePositiveOutcomeMatcher(dataset, targetColumn, positiveOutcome);
  const distributions = {};

  dataset.forEach((row) => {
    const group = normalizeCategorical(row[sensitiveAttr]) || "unknown";
    const targetValue = row[targetColumn];
    if (targetValue === null || targetValue === undefined || String(targetValue).trim() === "") {
      return;
    }

    if (!distributions[group]) {
      distributions[group] = { positive: 0, negative: 0, total: 0 };
    }

    if (isPositiveOutcome(targetValue)) {
      distributions[group].positive += 1;
    } else {
      distributions[group].negative += 1;
    }
    distributions[group].total += 1;
  });

  Object.values(distributions).forEach((stats) => {
    stats.positive_rate = stats.total > 0 ? stats.positive / stats.total : null;
    stats.negative_rate = stats.total > 0 ? stats.negative / stats.total : null;
  });

  return distributions;
};

const basicBiasScoreAggregator = (metrics) => {
  const demographicGap = metrics.demographicParityGap ?? 0;
  const disparateImpactRatio = metrics.disparateImpactRatio;

  let diPenalty = 1;
  if (typeof disparateImpactRatio === "number" && disparateImpactRatio > 0) {
    const normalizedRatio = disparateImpactRatio > 1 ? 1 / disparateImpactRatio : disparateImpactRatio;
    diPenalty = 1 - normalizedRatio;
  }

  // Interpretable weighted score in [0,1]:
  // 0.55 * demographic parity gap + 0.45 * disparate impact penalty.
  // Demographic parity gap captures absolute separation in positive rates.
  // DI penalty is (1 - min(DI, 1/DI)), where 0 means balanced DI and 1 means maximal disparity.
  const weightedScore = 0.55 * demographicGap + 0.45 * diPenalty;
  const score = Math.max(0, Math.min(1, Number(weightedScore.toFixed(4))));

  return score;
};

const riskLevelFromScore = (score) => {
  if (score >= 0.66) {
    return "HIGH";
  }
  if (score >= 0.33) {
    return "MEDIUM";
  }
  return "LOW";
};

const pearsonCorrelation = (x, y) => {
  const n = x.length;
  if (n < 2) {
    return 0;
  }
  const meanX = x.reduce((sum, value) => sum + value, 0) / n;
  const meanY = y.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) {
    return 0;
  }
  return numerator / Math.sqrt(denomX * denomY);
};

const buildContingencyTable = (dataset, colA, colB, preprocessA, preprocessB) => {
  const rowKeys = new Set();
  const colKeys = new Set();
  const table = {};

  dataset.forEach((row) => {
    const a = preprocessA(row[colA]);
    const b = preprocessB(row[colB]);
    if (!a || !b) {
      return;
    }
    rowKeys.add(a);
    colKeys.add(b);
    table[a] = table[a] || {};
    table[a][b] = (table[a][b] || 0) + 1;
  });

  return {
    table,
    rowKeys: [...rowKeys],
    colKeys: [...colKeys]
  };
};

const cramersV = (dataset, colA, colB, preprocessA, preprocessB) => {
  const { table, rowKeys, colKeys } = buildContingencyTable(dataset, colA, colB, preprocessA, preprocessB);
  const n = rowKeys.reduce(
    (sum, rowKey) => sum + colKeys.reduce((acc, colKey) => acc + (table[rowKey]?.[colKey] || 0), 0),
    0
  );
  if (!n || rowKeys.length < 2 || colKeys.length < 2) {
    return 0;
  }

  const rowTotals = {};
  const colTotals = {};
  rowKeys.forEach((rowKey) => {
    rowTotals[rowKey] = colKeys.reduce((acc, colKey) => acc + (table[rowKey]?.[colKey] || 0), 0);
  });
  colKeys.forEach((colKey) => {
    colTotals[colKey] = rowKeys.reduce((acc, rowKey) => acc + (table[rowKey]?.[colKey] || 0), 0);
  });

  let chi2 = 0;
  rowKeys.forEach((rowKey) => {
    colKeys.forEach((colKey) => {
      const observed = table[rowKey]?.[colKey] || 0;
      const expected = (rowTotals[rowKey] * colTotals[colKey]) / n;
      if (expected > 0) {
        chi2 += ((observed - expected) ** 2) / expected;
      }
    });
  });

  const minDim = Math.min(rowKeys.length - 1, colKeys.length - 1);
  if (minDim <= 0) {
    return 0;
  }
  return Math.sqrt((chi2 / n) / minDim);
};

const toQuantileBin = (value, min, max) => {
  if (value === null || min === null || max === null || max === min) {
    return null;
  }
  const normalized = (value - min) / (max - min);
  if (normalized < 0.2) return "bin_1";
  if (normalized < 0.4) return "bin_2";
  if (normalized < 0.6) return "bin_3";
  if (normalized < 0.8) return "bin_4";
  return "bin_5";
};

const detectProxyFeatures = (dataset, columns, sensitiveAttributes, targetColumn) => {
  const nonSensitiveFeatures = columns.filter(
    (column) => !sensitiveAttributes.includes(column) && column !== targetColumn
  );
  const flaggedFeatures = [];

  nonSensitiveFeatures.forEach((feature) => {
    sensitiveAttributes.forEach((sensitiveAttr) => {
      const featureNumbers = [];
      const sensitiveNumbers = [];

      dataset.forEach((row) => {
        const f = parseNumeric(row[feature]);
        const s = parseNumeric(row[sensitiveAttr]);
        if (f !== null && s !== null) {
          featureNumbers.push(f);
          sensitiveNumbers.push(s);
        }
      });

      let association = 0;
      const bothNumeric = featureNumbers.length >= 3 && sensitiveNumbers.length >= 3;
      if (bothNumeric) {
        association = Math.abs(pearsonCorrelation(featureNumbers, sensitiveNumbers));
      } else {
        const sensitiveNumericValues = dataset
          .map((row) => parseNumeric(row[sensitiveAttr]))
          .filter((value) => value !== null);
        const hasNumericSensitive = sensitiveNumericValues.length >= Math.ceil(dataset.length * 0.6);

        if (hasNumericSensitive) {
          const min = Math.min(...sensitiveNumericValues);
          const max = Math.max(...sensitiveNumericValues);
          association = cramersV(
            dataset,
            feature,
            sensitiveAttr,
            (value) => normalizeCategorical(value),
            (value) => {
              const numeric = parseNumeric(value);
              return toQuantileBin(numeric, min, max);
            }
          );
        } else {
          association = cramersV(
            dataset,
            feature,
            sensitiveAttr,
            (value) => normalizeCategorical(value),
            (value) => normalizeCategorical(value)
          );
        }
      }

      const roundedAssociation = Number(association.toFixed(4));
      if (roundedAssociation >= 0.6) {
        const risk = roundedAssociation >= 0.8 ? "HIGH" : "MEDIUM";
        flaggedFeatures.push({
          feature,
          sensitive_attribute: sensitiveAttr,
          correlation: roundedAssociation,
          risk
        });
      }
    });
  });

  flaggedFeatures.sort((a, b) => b.correlation - a.correlation);
  return flaggedFeatures;
};

const computeNumericCorrelationMatrix = (dataset, columns) => {
  const numericColumns = columns.filter((column) => {
    const numericCount = dataset.reduce((count, row) => (parseNumeric(row[column]) !== null ? count + 1 : count), 0);
    return numericCount >= Math.ceil(dataset.length * 0.8);
  });

  const matrix = {};
  numericColumns.forEach((columnA) => {
    matrix[columnA] = {};
    numericColumns.forEach((columnB) => {
      if (columnA === columnB) {
        matrix[columnA][columnB] = 1;
        return;
      }
      const valuesA = [];
      const valuesB = [];
      dataset.forEach((row) => {
        const a = parseNumeric(row[columnA]);
        const b = parseNumeric(row[columnB]);
        if (a !== null && b !== null) {
          valuesA.push(a);
          valuesB.push(b);
        }
      });
      matrix[columnA][columnB] = Number(Math.abs(pearsonCorrelation(valuesA, valuesB)).toFixed(4));
    });
  });

  return matrix;
};

const analyzeBias = ({
  dataset,
  columns,
  targetColumn,
  sensitiveAttributes,
  positiveOutcome,
  privilegedGroup = {},
  maxAnalysisRows = 10000
}) => {
  if (!targetColumn) {
    throw new AppError("targetColumn is required", 400);
  }
  if (!columns.includes(targetColumn)) {
    throw new AppError(`targetColumn '${targetColumn}' does not exist in dataset`, 400);
  }

  prepareSensitiveAttributes(dataset, sensitiveAttributes);

  const sampling = applyRandomSampling(dataset, maxAnalysisRows);
  const workingDataset = sampling.rows;

  const demographicParityByAttribute = {};
  const disparateImpactByAttribute = {};
  const groupDistributions = {};

  sensitiveAttributes.forEach((sensitiveAttr) => {
    demographicParityByAttribute[sensitiveAttr] = computeDemographicParity(
      workingDataset,
      targetColumn,
      sensitiveAttr,
      positiveOutcome
    );
    disparateImpactByAttribute[sensitiveAttr] = computeDisparateImpact(
      workingDataset,
      targetColumn,
      sensitiveAttr,
      positiveOutcome,
      privilegedGroup[sensitiveAttr]
    );
    groupDistributions[sensitiveAttr] = groupOutcomeDistribution(
      workingDataset,
      targetColumn,
      sensitiveAttr,
      positiveOutcome
    );
  });

  const maxDemographicGap = Math.max(
    ...Object.values(demographicParityByAttribute).map((entry) => entry.max_gap || 0)
  );
  const validRatios = Object.values(disparateImpactByAttribute)
    .map((entry) => entry.ratio)
    .filter((ratio) => typeof ratio === "number" && Number.isFinite(ratio));
  const minDisparateImpactRatio = validRatios.length ? Math.min(...validRatios) : null;

  const biasScore = basicBiasScoreAggregator({
    demographicParityGap: maxDemographicGap,
    disparateImpactRatio: minDisparateImpactRatio
  });
  const riskLevel = riskLevelFromScore(biasScore);

  const flaggedFeatures = detectProxyFeatures(workingDataset, columns, sensitiveAttributes, targetColumn);
  const numericCorrelationMatrix = computeNumericCorrelationMatrix(workingDataset, columns);
  const privilegedGroupUsed = {};
  Object.entries(disparateImpactByAttribute).forEach(([attribute, data]) => {
    privilegedGroupUsed[attribute] = {
      group: data.privileged_group,
      selection_method: data.privileged_selection_method
    };
  });

  return {
    bias_metrics: {
      demographic_parity: demographicParityByAttribute,
      disparate_impact: disparateImpactByAttribute,
      numeric_correlation_matrix: numericCorrelationMatrix
    },
    group_distributions: groupDistributions,
    flagged_features: flaggedFeatures,
    bias_score: biasScore,
    risk_level: riskLevel,
    assumptions: {
      privileged_group_used: privilegedGroupUsed,
      sampling_applied: sampling.sampled,
      sampling: {
        original_size: sampling.originalSize,
        sampled_size: sampling.sampledSize,
        threshold: sampling.maxRows
      }
    }
  };
};

module.exports = {
  analyzeBias,
  computeDemographicParity,
  computeDisparateImpact,
  groupOutcomeDistribution,
  basicBiasScoreAggregator
};
