const rateLimit = require("express-rate-limit");

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * General API rate limiter
 * Development: 1000 req / 15 min (relaxed for testing)
 * Production: 100 req / 15 min
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: isDevelopment 
      ? "Too many requests from this IP. Please try again after 15 minutes." 
      : "Too many requests from this IP. Please try again after 15 minutes.",
  },
  skip: isDevelopment ? (req) => false : undefined, // Always enforce in production
});

/**
 * Auth rate limiter (login/register/reset)
 * Development: 100 attempts / 15 min (relaxed for testing)
 * Production: 10 attempts / 15 min
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: isDevelopment
      ? "Too many authentication attempts. Please try again after 15 minutes."
      : "Too many authentication attempts. Please try again after 15 minutes.",
  },
});

/**
 * Upload rate limiter
 * Development: 100 uploads / hour (relaxed for testing)
 * Production: 20 uploads / hour
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: isDevelopment
      ? "Too many upload requests. Please try again after an hour."
      : "Too many upload requests. Please try again after an hour.",
  },
});

module.exports = { generalLimiter, authLimiter, uploadLimiter };
