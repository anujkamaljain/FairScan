const logger = require("../config/logger");
const { sendError } = require("../utils/apiResponse");

const notFoundHandler = (req, res) => {
  return sendError(res, `Route not found: ${req.originalUrl}`, 404);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  if (err.name === "MulterError") {
    statusCode = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Uploaded file exceeds 20MB limit" : err.message;
  }

  logger.error("Unhandled error", {
    statusCode,
    message,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack
  });

  return sendError(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === "production" ? null : err.stack
  );
};

module.exports = {
  notFoundHandler,
  errorHandler
};
