const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const buildLimiter = ({ windowMs, max }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please try again shortly."
    }
  });

const authLimiter = buildLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax
});

const apiLimiter = buildLimiter({
  windowMs: env.apiRateLimitWindowMs,
  max: env.apiRateLimitMax
});

module.exports = {
  authLimiter,
  apiLimiter
};
