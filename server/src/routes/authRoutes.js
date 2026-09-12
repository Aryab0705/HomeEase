const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");

// ── Validation rules ──────────────────────────────────────────────────────────
const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("role").optional().isIn(["customer", "provider"]).withMessage("Role must be customer or provider"),
  body("phone").optional().matches(/^[6-9]\d{9}$/).withMessage("Enter a valid Indian phone number"),
];

const loginRules = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const forgotRules = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
];

const resetRules = [
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
];

// ── Routes ────────────────────────────────────────────────────────────────────
router.post("/register", authLimiter, registerRules, validate, register);
router.post("/login", authLimiter, loginRules, validate, login);
router.post("/logout", protect, logout);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", authLimiter, forgotRules, validate, forgotPassword);
router.put("/reset-password/:token", resetRules, validate, resetPassword);
router.get("/me", protect, getMe);

module.exports = router;
