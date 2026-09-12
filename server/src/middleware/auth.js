const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");

/**
 * Protect routes — verifies JWT from Authorization header or cookie
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check Authorization header first
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // Fallback to cookie
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw new ApiError(401, "Not authorized. Please log in.");
  }

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Session expired. Please log in again.");
    }
    throw new ApiError(401, "Invalid token. Please log in again.");
  }

  // Attach user to request
  const user = await User.findById(decoded.id).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(401, "User not found. Token invalid.");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been suspended. Contact support.");
  }

  req.user = user;
  next();
});

module.exports = { protect };
