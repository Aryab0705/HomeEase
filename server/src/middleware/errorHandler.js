const ApiError = require("../utils/ApiError");

/**
 * Central error handling middleware
 * Must be registered AFTER all routes in app.js
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // ── Mongoose Errors ──────────────────────────────────────────────────────
  // Cast error (invalid ObjectId)
  if (err.name === "CastError") {
    error = new ApiError(400, `Invalid ${err.path}: ${err.value}`);
  }

  // Duplicate key error (e.g. unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    error = new ApiError(
      409,
      `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists.`
    );
  }

  // Validation error (mongoose schema)
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    error = new ApiError(422, messages[0], messages);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error = new ApiError(401, "Invalid token. Please log in again.");
  }
  if (err.name === "TokenExpiredError") {
    error = new ApiError(401, "Session expired. Please log in again.");
  }

  // ── Log in development ───────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    console.error("❌ Error:", err);
  }

  // ── Send response ────────────────────────────────────────────────────────
  res.status(error.statusCode).json({
    success: false,
    message: error.message || "Internal Server Error",
    errors: error.errors || [],
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

/**
 * 404 handler — catch-all for undefined routes
 */
const notFound = (req, res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found.`));
};

module.exports = { errorHandler, notFound };
