const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000/api/v1";

const readCsv = (filePath) => {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
};

const buildPayload = (rows) => ({
  predictions: rows.map((row) => row.prediction),
  groundTruth: rows.map((row) => row.groundTruth),
  features: rows.map(({ prediction, groundTruth, ...rest }) => rest),
  sensitiveAttributes: ["gender", "age_group"],
  positiveOutcome: "yes",
  privilegedGroup: { gender: "male" }
});

const run = async () => {
  const biasedRows = readCsv(path.join(__dirname, "../samples/model_eval_biased.csv"));
  const balancedRows = readCsv(path.join(__dirname, "../samples/model_eval_balanced.csv"));

  const biasedResponse = await fetch(`${API_BASE}/model/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(biasedRows))
  });
  const balancedResponse = await fetch(`${API_BASE}/model/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(balancedRows))
  });

  const biased = await biasedResponse.json();
  const balanced = await balancedResponse.json();

  console.log("Biased sample score:", biased?.data?.bias_score, "risk:", biased?.data?.risk_level);
  console.log("Balanced sample score:", balanced?.data?.bias_score, "risk:", balanced?.data?.risk_level);
};

run().catch((error) => {
  console.error("Model evaluator test failed:", error.message);
  process.exit(1);
});
