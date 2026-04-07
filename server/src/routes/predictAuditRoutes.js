const express = require("express");
const { predictWithAudit, getRecentRealtimeAuditLogs } = require("../controllers/predictAuditController");

const router = express.Router();

router.post("/", predictWithAudit);
router.get("/logs", getRecentRealtimeAuditLogs);

module.exports = router;
