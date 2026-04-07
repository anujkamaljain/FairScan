const express = require("express");
const { applyFix, downloadFixedDataset } = require("../controllers/biasMitigationController");

const router = express.Router();

router.post("/apply-fix", applyFix);
router.get("/fixed-datasets/:datasetId/download", downloadFixedDataset);

module.exports = router;
