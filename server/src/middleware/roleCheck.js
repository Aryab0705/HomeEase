const ApiError = require("../utils/ApiError");

/**
 * Role-based access control middleware
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Not authorized. Please log in."));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
    }
    next();
  };
};

/**
 * Check if user is admin or super_admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Not authorized. Please log in."));
  }
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return next(new ApiError(403, "Admin access required."));
  }
  next();
};

/**
 * Check if user is super_admin only
 */
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Not authorized. Please log in."));
  }
  if (req.user.role !== "super_admin") {
    return next(new ApiError(403, "Super Admin access required."));
  }
  next();
};

module.exports = { authorize, isAdmin, isSuperAdmin };
