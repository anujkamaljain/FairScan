const {
  generateBiasExplanation,
  generateAuditSummary,
  generateFixSuggestions
} = require("./geminiService");

const getNestedValues = (obj) => Object.values(obj || {}).filter((value) => typeof value === "object" && value !== null);

const getRuleBasedSuggestions = (payload = {}) => {
  const suggestions = [];
  const disparateImpact = payload?.bias_metrics?.disparate_impact || {};

  Object.entries(disparateImpact).forEach(([attribute, details]) => {
    if (typeof details?.ratio === "number" && details.ratio < 0.8) {
      suggestions.push({
        type: "REWEIGHT",
        explanation: `Disparate impact for '${attribute}' is ${details.ratio}. Consider reweighting or rebalancing training data.`
      });
    }
  });

  const flaggedFeatures = payload?.flagged_features || [];
  flaggedFeatures.forEach((feature) => {
    if (typeof feature?.correlation === "number" && feature.correlation >= 0.7) {
      suggestions.push({
        type: "FEATURE_REVIEW",
        explanation: `Feature '${feature.feature}' is strongly associated with '${feature.sensitive_attribute}' (${feature.correlation}). Review removal or transformation.`
      });
    }
  });

  const modelFpr = payload?.fairness_metrics?.fpr_by_group;
  if (modelFpr) {
    getNestedValues(modelFpr).forEach((groupFpr) => {
      const rates = Object.values(groupFpr).filter((value) => typeof value === "number");
      if (!rates.length) return;
      const spread = Math.max(...rates) - Math.min(...rates);
      if (spread > 0.2) {
        suggestions.push({
          type: "THRESHOLD_TUNING",
          explanation: `False positive rate spread is ${spread.toFixed(4)}. Consider threshold tuning or post-processing constraints.`
        });
      }
    });
  }

  if (payload?.reason_code === "COUNTERFACTUAL_FLIP") {
    suggestions.push({
      type: "COUNTERFACTUAL_ALERT",
      explanation: "Prediction flips under sensitive-attribute counterfactuals. Review model features and decision boundary."
    });
  } else if (payload?.reason_code === "CONFIDENCE_SHIFT") {
    suggestions.push({
      type: "STABILITY_CHECK",
      explanation: "Prediction confidence shifts under sensitive counterfactuals. Add fairness constraints and monitor drift."
    });
  }

  const deduped = [];
  const seen = new Set();
  suggestions.forEach((item) => {
    const key = `${item.type}:${item.explanation}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  });
  return deduped;
};

const buildExplainInput = (payload) => ({
  bias_metrics: payload?.bias_metrics || payload?.fairness_metrics || {},
  group_disparities: payload?.group_distributions || payload?.fairness_vs_accuracy || {},
  bias_score: payload?.bias_score ?? null,
  risk_level: payload?.risk_level || payload?.bias_risk || "UNKNOWN",
  reason_code: payload?.reason_code || "NONE"
});

const explainPayload = async (payload) => {
  const input = buildExplainInput(payload);
  const explanation = await generateBiasExplanation(input);
  const ruleBasedSuggestions = getRuleBasedSuggestions(payload);
  const suggestionResult = await generateFixSuggestions({
    input,
    rule_based_suggestions: ruleBasedSuggestions
  });

  return {
    explanation: explanation.explanation,
    summary_points: explanation.summary_points || [],
    suggestions: suggestionResult.suggestions || ruleBasedSuggestions
  };
};

const generateStructuredReport = async (payload) => {
  return generateAuditSummary(payload);
};

module.exports = {
  explainPayload,
  generateStructuredReport,
  getRuleBasedSuggestions
};
