const express = require("express");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const healthRoutes = require("./healthRoutes");
const datasetRoutes = require("./datasetRoutes");
const modelRoutes = require("./modelRoutes");
const predictAuditRoutes = require("./predictAuditRoutes");
const explainRoutes = require("./explainRoutes");
const reportRoutes = require("./reportRoutes");
const biasRoutes = require("./biasRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const authRoutes = require("./authRoutes");

const router = express.Router();

router.use("/", healthRoutes);
router.use("/auth", authRoutes);
router.use("/dashboard", optionalAuth, dashboardRoutes);
router.use("/datasets", requireAuth, datasetRoutes);
router.use("/model", requireAuth, modelRoutes);
router.use("/predict-with-audit", requireAuth, predictAuditRoutes);
router.use("/explain", requireAuth, explainRoutes);
router.use("/report", requireAuth, reportRoutes);
router.use("/bias", requireAuth, biasRoutes);

module.exports = router;
