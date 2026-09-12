const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

/**
 * Run after express-validator rules — collects errors and throws ApiError
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    return next(new ApiError(422, messages[0], errors.array()));
  }
  next();
};

module.exports = { validate };
