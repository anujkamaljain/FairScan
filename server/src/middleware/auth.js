const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { sendError } = require("../utils/apiResponse");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return sendError(res, "Authentication token missing", 401);
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    return next();
  } catch (error) {
    return sendError(res, "Invalid or expired token", 401);
  }
};

module.exports = authMiddleware;
