const express = require("express");
const healthRoutes = require("./healthRoutes");
const datasetRoutes = require("./datasetRoutes");

const router = express.Router();

router.use("/", healthRoutes);
router.use("/datasets", datasetRoutes);

module.exports = router;
