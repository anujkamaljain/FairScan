const test = require("node:test");
const assert = require("node:assert/strict");

const { __private } = require("../src/services/biasMitigationService");

test("buildAutoFixCandidates includes baseline and remove-feature options", () => {
  const beforeAnalysis = {
    flagged_features: [
      { feature: "zipcode", correlation: 0.89 },
      { feature: "zipcode", correlation: 0.82 },
      { feature: "education_level", correlation: 0.71 }
    ]
  };

  const candidates = __private.buildAutoFixCandidates({
    beforeAnalysis,
    targetColumn: "approved",
    maxRemoveFeatureCandidates: 2
  });

  assert.equal(candidates[0].fixType, "REWEIGHT");
  assert.equal(candidates[1].fixType, "BALANCE");
  assert.equal(candidates[2].fixType, "BALANCE");
  const removeCandidates = candidates.filter((candidate) => candidate.fixType === "REMOVE_FEATURE");
  assert.equal(removeCandidates.length, 2);
  assert.deepEqual(
    removeCandidates.map((candidate) => candidate.config.feature),
    ["zipcode", "education_level"]
  );
});

test("chooseBestAutoFix ranks by largest improvement delta", () => {
  const evaluations = [
    {
      fixType: "REWEIGHT",
      improvement: { delta: 0.03, percentage_change: 4.2 },
      after: { bias_score: 0.52 }
    },
    {
      fixType: "BALANCE",
      improvement: { delta: 0.09, percentage_change: 11.8 },
      after: { bias_score: 0.46 }
    },
    {
      fixType: "REMOVE_FEATURE",
      improvement: { delta: 0.05, percentage_change: 7.6 },
      after: { bias_score: 0.5 }
    }
  ];

  const { selected, ranked } = __private.chooseBestAutoFix(evaluations);
  assert.equal(selected.fixType, "BALANCE");
  assert.equal(ranked[0].fixType, "BALANCE");
  assert.equal(ranked[1].fixType, "REMOVE_FEATURE");
  assert.equal(ranked[2].fixType, "REWEIGHT");
});

test("scoreMitigationDelta handles baseline zero safely", () => {
  const scored = __private.scoreMitigationDelta({ beforeScore: 0, afterScore: 0.2 });
  assert.equal(scored.delta, -0.2);
  assert.equal(scored.percentage_change, 0);
});
