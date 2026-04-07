const express = require("express");
const { applyFix } = require("../controllers/biasMitigationController");

const router = express.Router();

router.post("/apply-fix", applyFix);

module.exports = router;
