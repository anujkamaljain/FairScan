const test = require("node:test");
const assert = require("node:assert/strict");

const { parseDatasetBuffer } = require("../src/services/datasetIngestionService");

test("parseDatasetBuffer parses CSV and normalizes missing values", async () => {
  const csv = Buffer.from("gender,approved,score\nmale,yes,90\nfemale,NA,85\n");
  const result = await parseDatasetBuffer({
    buffer: csv,
    originalname: "dataset.csv"
  });

  assert.equal(result.summary.rows, 2);
  assert.equal(result.summary.columns, 3);
  assert.deepEqual(result.columns, ["gender", "approved", "score"]);
  assert.equal(result.rows[1].approved, null);
});

test("parseDatasetBuffer rejects unsupported extensions", async () => {
  await assert.rejects(
    parseDatasetBuffer({
      buffer: Buffer.from("irrelevant"),
      originalname: "dataset.txt"
    }),
    /Unsupported file format/
  );
});
