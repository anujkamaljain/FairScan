const { GoogleGenAI } = require("@google/genai");
const env = require("../config/env");
const logger = require("../config/logger");

const SYSTEM_PROMPT =
  "You are an AI fairness auditor. Your job is to explain bias in clear, factual, non-emotional language for business and compliance teams.";

const FALLBACK_EXPLANATION = {
  explanation: "Explanation unavailable. Showing raw metrics instead.",
  summary_points: ["Review raw metrics to determine impacted groups and disparity severity."]
};

const safeStringify = (value) => JSON.stringify(value, null, 2);

const withTimeout = async (promise, timeoutMs) => {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Timeouts, 503s, and overload messages warrant longer backoff between retries. */
const isTransientGeminiFailure = (error) => {
  const msg = String(error?.message || "").toLowerCase();
  const status = error?.status ?? error?.statusCode ?? error?.code ?? error?.cause?.status ?? error?.cause?.code;
  if (msg.includes("timed out")) return true;
  if (status === 503 || status === 429) return true;
  return (
    msg.includes("unavailable") || msg.includes("high demand") || msg.includes("try again later")
  );
};

const emitFallbackAlert = async ({ operation, reason }) => {
  if (!env.geminiAlertWebhookUrl) return;
  let timeout;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 1500);
    await fetch(env.geminiAlertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        event: "gemini_fallback",
        service: "fairscan-api",
        operation,
        reason,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    logger.warn("Gemini fallback alert webhook failed", { error: error.message, operation });
  } finally {
    clearTimeout(timeout);
  }
};

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
    void emitFallbackAlert({ operation, reason: "missing_api_key" });
    return fallback;
  }

  const prompt = [
    "Input JSON:",
    safeStringify(inputJson),
    "",
    "Instructions:",
    instructions,
    `- Keep explanation under ${maxWords} words.`,
    "- Use only values present in Input JSON.",
    "- Return strict JSON only with no markdown.",
    "",
    "Output schema:",
    safeStringify(fallback)
  ].join("\n");

  try {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const perAttemptTimeoutMs = Math.min(
          120000,
          env.geminiTimeoutMs + (attempt - 1) * 15000
        );
        const response = await withTimeout(
          ai.models.generateContent({
            model: env.geminiModel,
            contents: [
              { role: "user", parts: [{ text: prompt }] }
            ],
            config: {
              systemInstruction: SYSTEM_PROMPT,
              temperature: 0.2,
              responseMimeType: "application/json"
            }
          }),
          perAttemptTimeoutMs
        );

        const text = response.text || "";
        const parsed = parseJsonResponse(text, fallback);
        if (parsed !== fallback) {
          return parsed;
        }
        lastError = new Error("Gemini returned non-JSON response");
      } catch (error) {
        lastError = error;
      }

      if (attempt < 3) {
        const backoffMs = isTransientGeminiFailure(lastError)
          ? Math.min(10000, 1500 * 2 ** (attempt - 1))
          : 350 * attempt;
        await sleep(backoffMs);
      }
    }

    throw lastError || new Error("Gemini call failed");
  } catch (error) {
    logger.warn("Gemini call failed. Returning fallback.", {
      event: "gemini_fallback",
      operation,
      error: error.message
    });
    void emitFallbackAlert({ operation, reason: error.message });
    return fallback;
  }
};

const generateBiasExplanation = async (input) => {
  return runGeminiStructured({
    operation: "generateBiasExplanation",
    inputJson: input,
    instructions: [
      "- Explain WHAT is happening in fairness metrics.",
      "- Explain WHY based only on numeric disparities.",
      "- Mention affected groups explicitly.",
      "- Avoid speculation and buzzwords."
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
      "- Produce an audit-ready summary with explicit sections.",
      "- Keep each section concise and grounded in provided metrics.",
      "- Do not invent thresholds or values."
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
      "- Convert rule-based suggestions into concise implementation advice.",
      "- Keep each suggestion factual and tied to provided metrics.",
      "- Preserve suggestion type labels."
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
