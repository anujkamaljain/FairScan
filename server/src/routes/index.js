const express = require("express");
const healthRoutes = require("./healthRoutes");
const datasetRoutes = require("./datasetRoutes");
const modelRoutes = require("./modelRoutes");
const predictAuditRoutes = require("./predictAuditRoutes");

const router = express.Router();

router.use("/", healthRoutes);
router.use("/datasets", datasetRoutes);
router.use("/model", modelRoutes);
router.use("/predict-with-audit", predictAuditRoutes);

module.exports = router;
