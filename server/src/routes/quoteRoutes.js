const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const {
  submitQuote,
  getQuotesForBooking,
  acceptQuote,
  getMyQuotes,
} = require("../controllers/quoteController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validate } = require("../middleware/validate");

const quoteRules = [
  body("bookingId").notEmpty().isMongoId().withMessage("Valid booking ID required"),
  body("estimatedCost").isNumeric().withMessage("Estimated cost must be a number"),
  body("estimatedDuration.value").isNumeric().withMessage("Duration value required"),
];

router.post("/", protect, authorize("provider"), quoteRules, validate, submitQuote);
router.get("/my", protect, authorize("provider"), getMyQuotes);
router.get("/booking/:bookingId", protect, authorize("customer"), getQuotesForBooking);
router.patch("/:id/accept", protect, authorize("customer"), acceptQuote);

module.exports = router;
