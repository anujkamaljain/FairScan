const logger = require("../config/logger");

const auditQueue = [];
let queueProcessor = null;
let workerStarted = false;

const enqueueAuditLog = (item) => {
  auditQueue.push(item);
};

const registerAuditProcessor = (processor) => {
  queueProcessor = processor;
};

const processNext = async () => {
  if (!queueProcessor || !auditQueue.length) {
    return;
  }

  const item = auditQueue.shift();
  try {
    await queueProcessor(item);
  } catch (error) {
    logger.error("Failed to process audit queue item", { error: error.message });
  }
};

const startAuditQueueWorker = () => {
  if (workerStarted) {
    return;
  }
  workerStarted = true;
  setInterval(() => {
    processNext();
  }, 250);
};

module.exports = {
  enqueueAuditLog,
  registerAuditProcessor,
  startAuditQueueWorker
};
