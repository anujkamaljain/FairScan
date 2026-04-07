const logger = require("../config/logger");
const { sendError } = require("../utils/apiResponse");

const notFoundHandler = (req, res) => {
  return sendError(res, `Route not found: ${req.originalUrl}`, 404);
};

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  const isOperational = Boolean(err.statusCode && err.statusCode < 500);

  if (err.name === "MulterError") {
    statusCode = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Uploaded file exceeds 20MB limit" : err.message;
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  }

  const logLevel = isOperational ? "warn" : "error";
  logger[logLevel](isOperational ? "Operational error" : "Unexpected error", {
    statusCode,
    message,
    path: req.originalUrl,
    method: req.method,
    ...(isOperational ? {} : { stack: err.stack })
  });

  return sendError(
    res,
    statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : message,
    statusCode,
    process.env.NODE_ENV === "production" ? null : err.stack
  );
};

module.exports = {
  notFoundHandler,
  errorHandler
};
