const test = require("node:test");
const assert = require("node:assert/strict");

const envKeys = ["ML_ALLOW_MOCK_FALLBACK", "NODE_ENV", "ML_SERVICE_URL"];

const resetServiceModules = () => {
  delete require.cache[require.resolve("../src/config/env")];
  delete require.cache[require.resolve("../src/services/modelInferenceService")];
};

const withEnv = async (overrides, run) => {
  const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  try {
    Object.entries(overrides).forEach(([key, value]) => {
      process.env[key] = value;
    });
    resetServiceModules();
    await run();
  } finally {
    envKeys.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
    resetServiceModules();
  }
};

test("vertex inference throws when fallback is disabled", async () => {
  await withEnv(
    {
      NODE_ENV: "development",
      ML_ALLOW_MOCK_FALLBACK: "false",
      ML_SERVICE_URL: "http://localhost:9999"
    },
    async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ detail: "Vertex inference failed" })
      });
      try {
        const { predict } = require("../src/services/modelInferenceService");
        await assert.rejects(predict({ income: 50000 }, { type: "vertex" }), /temporarily unavailable/i);
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
});

test("vertex inference falls back to mock when enabled", async () => {
  await withEnv(
    {
      NODE_ENV: "development",
      ML_ALLOW_MOCK_FALLBACK: "true",
      ML_SERVICE_URL: "http://localhost:9999"
    },
    async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ detail: "upstream error" })
      });
      try {
        const { predict } = require("../src/services/modelInferenceService");
        const result = await predict({ income: 50000 }, { type: "vertex" });
        assert.equal(result.model_type, "mock-fallback");
        assert.ok(typeof result.confidence === "number");
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
});
