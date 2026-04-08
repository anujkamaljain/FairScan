const { GoogleGenAI } = require("@google/genai");
const env = require("../config/env");
const logger = require("../config/logger");

/**
 * Global system instruction for all Gemini structured outputs used in FairScan.
 * Kept in one place so explain, report, and suggestion flows stay consistent.
 */
const SYSTEM_PROMPT = [
  "You are a senior machine-learning fairness and responsible-AI analyst supporting enterprise audit, risk, and compliance workflows.",
  "Write in polished professional English: precise, neutral, and defensible. Avoid hype, slang, moralizing, and emotional language.",
  "Ground every substantive claim in the provided JSON payload. Do not invent statistics, group names, thresholds, legal findings, or organizational facts.",
  "Distinguish observation (what the metrics show) from interpretation (what it may imply operationally). Flag uncertainty when the payload is incomplete.",
  "Do not provide discriminatory guidance or recommendations that would violate fair-lending or equal-treatment principles; frame mitigations as governance and technical controls.",
  "Output must be valid JSON only, matching the supplied schema exactly. No markdown fences, no commentary outside the JSON object."
].join(" ");

const STRUCTURED_OUTPUT_RULES = [
  "Return a single JSON object only—no markdown code fences, no preamble, no postscript.",
  "Populate every key defined in the Output schema; use the schema’s types and array shapes.",
  "Do not add keys that are not implied by the Output schema.",
  "Quote or paraphrase metrics only from Input JSON; if a value is missing, state that limitation inside the allowed string fields rather than fabricating numbers."
].join(" ");

const FALLBACK_EXPLANATION = {
  explanation: "Explanation unavailable. Showing raw metrics instead.",
  summary_points: ["Review raw metrics to determine impacted groups and disparity severity."]
};

const safeStringify = (value) => JSON.stringify(value, null, 2);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Google client sometimes nests API errors as JSON inside `message`. */
const nestedHttpCode = (error) => {
  const msg = String(error?.message || "");
  const match = msg.match(/"code"\s*:\s*(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
};

/** 503s and overload messages warrant longer backoff between retries. */
const isTransientGeminiFailure = (error) => {
  const msg = String(error?.message || "").toLowerCase();
  const nested = nestedHttpCode(error);
  const status =
    nested ??
    error?.status ??
    error?.statusCode ??
    error?.code ??
    error?.cause?.status ??
    error?.cause?.code;
  if (msg.includes("timed out")) return true;
  if (status === 503 || status === 429) return true;
  if (msg.includes('"status":"unavailable"') || msg.includes("unavailable")) return true;
  return msg.includes("high demand") || msg.includes("try again later") || msg.includes("overloaded");
};

const transientBackoffMs = (attempt) => Math.min(30000, 2000 * 2 ** (attempt - 1));

const getGeminiClient = () => {
  if (!env.geminiApiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
};

const parseJsonResponse = (text, fallback) => {
  if (!text || typeof text !== "string") {
    return fallback;
  }
  const trimmed = text.trim();
  const normalized = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(normalized);
  } catch (error) {
    return fallback;
  }
};

const runGeminiStructured = async ({ operation, inputJson, instructions, fallback, maxWords = 120 }) => {
  const ai = getGeminiClient();
  if (!ai) {
    logger.warn("Gemini API key missing, returning fallback response", { event: "gemini_fallback", operation });
    return fallback;
  }

  const prompt = [
    "Input JSON:",
    safeStringify(inputJson),
    "",
    "Task-specific instructions:",
    instructions,
    "",
    "Length and density:",
    `- Keep the total prose in your JSON string values within roughly ${maxWords} words unless the schema requires brevity in list items.`,
    "",
    "Structured output contract:",
    STRUCTURED_OUTPUT_RULES,
    "",
    "Output schema (conform exactly):",
    safeStringify(fallback)
  ].join("\n");

  const maxAttemptsPrimary = 5;
  const maxAttemptsFallback = 3;

  const callModel = async (modelId) => {
    return ai.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.15,
        responseMimeType: "application/json"
      }
    });
  };

  const tryModel = async (modelId, maxAttempts, label) => {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await callModel(modelId);
        const text = response.text || "";
        const parsed = parseJsonResponse(text, fallback);
        if (parsed !== fallback) {
          return parsed;
        }
        lastError = new Error("Gemini returned non-JSON response");
      } catch (error) {
        lastError = error;
      }

      if (attempt < maxAttempts) {
        const backoffMs = isTransientGeminiFailure(lastError) ? transientBackoffMs(attempt) : 400 * attempt;
        await sleep(backoffMs);
      }
    }
    return { error: lastError || new Error("Gemini call failed"), modelLabel: label };
  };

  try {
    let outcome = await tryModel(env.geminiModel, maxAttemptsPrimary, "primary");
    if (typeof outcome !== "object" || outcome === null || !("error" in outcome)) {
      return outcome;
    }

    const fallbackModel = env.geminiFallbackModel;
    if (
      fallbackModel &&
      fallbackModel !== env.geminiModel &&
      isTransientGeminiFailure(outcome.error)
    ) {
      logger.warn("Gemini primary model retries exhausted; trying fallback model", {
        operation,
        primaryModel: env.geminiModel,
        fallbackModel
      });
      outcome = await tryModel(fallbackModel, maxAttemptsFallback, "fallback");
      if (typeof outcome !== "object" || outcome === null || !("error" in outcome)) {
        return outcome;
      }
    }

    throw outcome.error;
  } catch (error) {
    logger.warn("Gemini call failed. Returning fallback.", {
      event: "gemini_fallback",
      operation,
      error: error.message
    });
    return fallback;
  }
};

const generateBiasExplanation = async (input) => {
  return runGeminiStructured({
    operation: "generateBiasExplanation",
    inputJson: input,
    instructions: [
      "Produce `explanation` as a tight executive summary of disparity and risk signals visible in the payload (bias_metrics, group_disparities, bias_score, risk_level, reason_code).",
      "Produce `summary_points` as 3–6 bullets: each bullet one concrete observation tied to a metric or group named in the input; order roughly from highest materiality to supporting detail.",
      "Use discipline-specific vocabulary (demographic parity, disparate impact, FPR/FNR, correlation) only where it matches the fields present; otherwise describe numerically.",
      "If reason_code is not NONE, explicitly relate the narrative to that code without naming internal enum values as if they were legal conclusions.",
      "Do not recommend illegal or unethical practices; recommend measurement, monitoring, documentation, and model governance actions only."
    ].join("\n"),
    fallback: FALLBACK_EXPLANATION
  });
};

const generateAuditSummary = async (input) => {
  const fallback = {
    overview: "Explanation unavailable. Showing raw metrics instead.",
    key_findings: ["Review fairness and accuracy metrics in the source payload."],
    risk_assessment: "Unable to generate narrative risk assessment.",
    recommendations: ["Use rule-based mitigation and re-run evaluation."]
  };

  return runGeminiStructured({
    operation: "generateAuditSummary",
    inputJson: input,
    instructions: [
      "`overview`: neutral situational summary suitable for an audit workpaper cover note (2–4 sentences).",
      "`key_findings`: 4–8 bullets, each citing specific metrics, groups, or fields from the payload; use quantitative language where the input provides numbers.",
      "`risk_assessment`: structured narrative of fairness and model-risk posture grounded solely in the payload; state severity in operational terms, not legal verdicts.",
      "`recommendations`: 4–7 actionable, professionally phrased next steps (monitoring, validation, documentation, stakeholder review, remediation planning). Avoid vague advice.",
      "Maintain audit traceability: a reader with only the input JSON should be able to map each sentence to supplied data.",
      "If the payload mixes dataset, model, and realtime contexts, segment findings clearly without conflating scopes."
    ].join("\n"),
    fallback,
    maxWords: 180
  });
};

const generateFixSuggestions = async (input) => {
  const fallback = {
    suggestions: input.rule_based_suggestions || []
  };

  return runGeminiStructured({
    operation: "generateFixSuggestions",
    inputJson: input,
    instructions: [
      "Transform `rule_based_suggestions` into a refined `suggestions` array: preserve each item’s `type` exactly; rewrite `explanation` for clarity, imperative voice, and implementation focus (who/what/when at a high level).",
      "Each explanation must remain traceable to the metric or condition that produced the rule-based entry; do not add new remediation categories.",
      "Prefer language suitable for a model risk committee or ML engineering backlog: specific, testable, and free of unfounded performance guarantees.",
      "If `rule_based_suggestions` is empty, return `suggestions` as an empty array."
    ].join("\n"),
    fallback,
    maxWords: 140
  });
};

module.exports = {
  generateBiasExplanation,
  generateAuditSummary,
  generateFixSuggestions
};
