const express = require("express");
const { explainDataset, explainModel, explainRealtime } = require("../controllers/explainController");

const router = express.Router();

router.post("/dataset", explainDataset);
router.post("/model", explainModel);
router.post("/realtime", explainRealtime);

module.exports = router;
