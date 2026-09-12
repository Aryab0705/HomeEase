const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const {
  getProviders,
  getProviderById,
  getMyProviderProfile,
  updateProviderProfile,
  updateMyServices,
  addPortfolioItem,
  deletePortfolioItem,
  uploadDocument,
  verifyProvider,
  getCategories,
  getMyAvailability,
  updateMyAvailability,
  getMyVerification,
  submitIdentityVerification,
  submitExperienceVerification,
  submitSkillsVerification,
  submitQualificationVerification,
  submitForReview,
  getMySettings,
  updateMySettings,
} = require("../controllers/providerController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validate } = require("../middleware/validate");
const { uploadSingle, uploadMultiple, uploadDocMultiple } = require("../middleware/upload");

// Provider - own profile
router.get("/profile", protect, authorize("provider"), getMyProviderProfile);
router.put("/profile", protect, authorize("provider"), updateProviderProfile);
router.get("/me/profile", protect, authorize("provider"), getMyProviderProfile);
router.put("/me/profile", protect, authorize("provider"), updateProviderProfile);
router.get("/me/availability", protect, authorize("provider"), getMyAvailability);
router.put("/me/availability", protect, authorize("provider"), updateMyAvailability);
router.get("/me/settings", protect, authorize("provider"), getMySettings);
router.put("/me/settings", protect, authorize("provider"), updateMySettings);
router.put("/me/services", protect, authorize("provider"), updateMyServices);
router.put("/me/services/:serviceId", protect, authorize("provider"), updateMyServices);

// Portfolio
router.post(
  "/me/portfolio",
  protect,
  authorize("provider"),
  uploadMultiple,
  addPortfolioItem
);
router.delete(
  "/me/portfolio/:itemId",
  protect,
  authorize("provider"),
  deletePortfolioItem
);

// Document upload (legacy)
router.post(
  "/me/documents",
  protect,
  authorize("provider"),
  uploadSingle,
  uploadDocument
);

// ── Verification submission ─────────────────────────────────────────────────
router.get("/me/verification", protect, authorize("provider"), getMyVerification);
router.put("/me/verification/identity", protect, authorize("provider"), uploadDocMultiple, submitIdentityVerification);
router.put("/me/verification/experience", protect, authorize("provider"), uploadDocMultiple, submitExperienceVerification);
router.put("/me/verification/skills", protect, authorize("provider"), submitSkillsVerification);
router.put("/me/verification/qualification", protect, authorize("provider"), uploadDocMultiple, submitQualificationVerification);
router.post("/me/verification/submit", protect, authorize("provider"), submitForReview);

// Admin verification
router.get(
  "/admin/list",
  protect,
  authorize("admin"),
  getProviders
);

router.patch(
  "/:id/verify",
  protect,
  authorize("admin"),
  [body("status").isIn(["verified", "rejected"]).withMessage("Invalid status"), validate],
  verifyProvider
);

// Public
router.get("/categories", getCategories);
router.get("/", getProviders);
router.get("/:id", getProviderById);

module.exports = router;
