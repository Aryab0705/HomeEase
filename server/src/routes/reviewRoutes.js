const express = require("express");
const { body, param } = require("express-validator");
const router = express.Router();

const {
  createReview,
  getProviderReviews,
  getMyReviews,
  getReviewForBooking,
  respondToReview,
  toggleReviewVisibility,
} = require("../controllers/reviewController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validate } = require("../middleware/validate");
const { uploadMultiple } = require("../middleware/upload");
const { normalizeReviewPayload } = require("../middleware/normalizeReviewPayload");

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 1000;

/**
 * Star validator for a single category.
 * Runs AFTER normalizeReviewPayload, so every supported client payload shape
 * has already been collapsed into `ratings.<canonicalKey>`.
 */
const star = (path, label) =>
  body(path)
    .exists({ checkNull: true })
    .withMessage(`${label} rating is required.`)
    .bail()
    .isInt({ min: 1, max: 5 })
    .withMessage(`${label} rating must be a whole number from 1 to 5.`)
    .toInt();

const reviewRules = [
  body("bookingId")
    .trim()
    .notEmpty()
    .withMessage("Booking ID is required.")
    .bail()
    .isMongoId()
    .withMessage("A valid booking ID is required."),

  // overallRating is computed server-side — not validated from client input
  star("ratings.workQuality", "Work quality"),
  star("ratings.punctuality", "Punctuality"),
  star("ratings.professionalism", "Professionalism"),
  star("ratings.valueForMoney", "Value for money"),

  body("comment")
    .trim()
    .notEmpty()
    .withMessage("Please write a short review before submitting.")
    .bail()
    .isLength({ min: MIN_COMMENT_LENGTH, max: MAX_COMMENT_LENGTH })
    .withMessage(
      `Your review must be between ${MIN_COMMENT_LENGTH} and ${MAX_COMMENT_LENGTH} characters.`
    ),
];

const respondRules = [
  param("id").isMongoId().withMessage("A valid review ID is required."),
  body("comment")
    .trim()
    .notEmpty()
    .withMessage("Response cannot be empty.")
    .bail()
    .isLength({ max: MAX_COMMENT_LENGTH })
    .withMessage(`Response cannot exceed ${MAX_COMMENT_LENGTH} characters.`),
];

// ── Customer ─────────────────────────────────────────────────────────────────
// NOTE ON ORDER: uploadMultiple must run before normalizeReviewPayload so that
// multipart text fields are populated on req.body first. normalizeReviewPayload
// must run before the validators so they see canonical field names.
router.post(
  "/",
  protect,
  authorize("customer"),
  uploadMultiple,
  normalizeReviewPayload,
  reviewRules,
  validate,
  createReview
);

router.get("/my", protect, authorize("customer"), getMyReviews);

// Review attached to a specific booking — visible to that booking's customer,
// its provider, and admins. Used to render "your submitted review" inline.
router.get(
  "/booking/:bookingId",
  protect,
  [param("bookingId").isMongoId().withMessage("A valid booking ID is required.")],
  validate,
  getReviewForBooking
);

// ── Public ───────────────────────────────────────────────────────────────────
// Any visitor can read a provider's reviews — this is the provider's public
// reputation, so it is intentionally unauthenticated.
router.get(
  "/provider/:providerId",
  [param("providerId").isMongoId().withMessage("A valid provider ID is required.")],
  validate,
  getProviderReviews
);

// ── Provider ─────────────────────────────────────────────────────────────────
router.post(
  "/:id/respond",
  protect,
  authorize("provider"),
  respondRules,
  validate,
  respondToReview
);

// ── Admin ────────────────────────────────────────────────────────────────────
router.patch(
  "/:id/visibility",
  protect,
  authorize("admin", "super_admin"),
  [param("id").isMongoId().withMessage("A valid review ID is required.")],
  validate,
  toggleReviewVisibility
);

module.exports = router;
