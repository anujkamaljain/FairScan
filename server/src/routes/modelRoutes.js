const express = require("express");
const { evaluateModel } = require("../controllers/modelFairnessController");

const router = express.Router();

router.post("/evaluate", evaluateModel);

module.exports = router;
