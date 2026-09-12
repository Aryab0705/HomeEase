const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  getAllUsers,
  toggleBlockUser,
  deleteUser,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validate } = require("../middleware/validate");
const { uploadSingle } = require("../middleware/upload");

const updateProfileRules = [
  body("name").optional().trim().isLength({ min: 2 }).withMessage("Name too short"),
  body("email").optional().isEmail().normalizeEmail().withMessage("Invalid email"),
  body("phone").optional().matches(/^[6-9]\d{9}$/).withMessage("Invalid phone number"),
];

const changePasswordRules = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
];

// My profile
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfileRules, validate, updateProfile);
router.put("/change-password", protect, changePasswordRules, validate, changePassword);
router.put("/avatar", protect, uploadSingle, uploadAvatar);

// Admin routes
router.get("/", protect, authorize("admin"), getAllUsers);
router.put("/:id/block", protect, authorize("admin"), toggleBlockUser);
router.delete("/:id", protect, authorize("admin"), deleteUser);

module.exports = router;
