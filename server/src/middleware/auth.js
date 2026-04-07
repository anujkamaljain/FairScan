const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { sendError } = require("../utils/apiResponse");

const buildAuthMiddleware = (required = true) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    if (!required) {
      req.user = null;
      return next();
    }
    return sendError(res, "Authentication token missing", 401);
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    return next();
  } catch (error) {
    if (!required) {
      req.user = null;
      return next();
    }
    return sendError(res, "Invalid or expired token", 401);
  }
};

module.exports = {
  requireAuth: buildAuthMiddleware(true),
  optionalAuth: buildAuthMiddleware(false),
  buildAuthMiddleware
};
