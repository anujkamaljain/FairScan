const express = require("express");
const { applyFix, autoFix, downloadFixedDataset } = require("../controllers/biasMitigationController");

const router = express.Router();

router.post("/apply-fix", applyFix);
router.post("/auto-fix", autoFix);
router.get("/fixed-datasets/:datasetId/download", downloadFixedDataset);

module.exports = router;
