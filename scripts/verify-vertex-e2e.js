const baseApi = process.env.API_BASE_URL || "http://localhost:5000/api/v1";
const mlBase = process.env.ML_BASE_URL || "http://127.0.0.1:8001";

const parseJsonSafe = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const req = async (url, options = {}) => {
  const response = await fetch(url, options);
  return { status: response.status, body: await parseJsonSafe(response) };
};

const run = async () => {
  const mlHealth = await req(`${mlBase}/health`);
  const mlValidate = await req(`${mlBase}/validate-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputData: { income: 72000, credit_score: 730, tenure_years: 4 }
    })
  });
  const mlPredict = await req(`${mlBase}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputData: { income: 72000, credit_score: 730, tenure_years: 4 }
    })
  });

  const email = `vertex.e2e.${Date.now()}@test.dev`;
  const signup = await req(`${baseApi}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Vertex E2E", email, password: "Pass@123" })
  });

  const token = signup.body?.data?.token;
  const backendPredict = await req(`${baseApi}/predict-with-audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      inputData: { income: 72000, credit_score: 730, gender: "female", age_group: "26-35" },
      sensitiveAttributes: ["gender", "age_group"],
      modelConfig: { type: "vertex" }
    })
  });

  console.log(
    JSON.stringify(
      {
        ml: {
          health: mlHealth,
          validateModel: mlValidate,
          predict: mlPredict
        },
        backend: {
          signup,
          predictWithAuditVertex: backendPredict
        }
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
