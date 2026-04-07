const express = require("express");
const { uploadAndAnalyzeDataset } = require("../controllers/datasetController");
const { uploadDatasetFile } = require("../middleware/upload");

const router = express.Router();

router.post("/upload-and-analyze", uploadDatasetFile.single("file"), uploadAndAnalyzeDataset);

module.exports = router;
