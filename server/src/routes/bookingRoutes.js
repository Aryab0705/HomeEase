const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const {
  createBooking,
  createCheckoutOrder,
  verifyAndCreateBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  uploadWorkImages,
  getAllBookings,
  createConsultationOrder,
  verifyConsultationPayment,
  completeSiteVisit,
  recordCustomerDecision,
  processPayment,
} = require("../controllers/bookingController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validate } = require("../middleware/validate");
const { uploadMultiple } = require("../middleware/upload");

const createBookingRules = [
  body("providerId").notEmpty().isMongoId().withMessage("Valid provider ID required"),
  body("serviceId").notEmpty().isMongoId().withMessage("Valid service ID required"),
  body("scheduledDate").notEmpty().isISO8601().withMessage("Valid scheduled date required"),
  body("address.street").notEmpty().withMessage("Street is required"),
  body("address.city").notEmpty().withMessage("City is required"),
  body("address.state").notEmpty().withMessage("State is required"),
  body("address.pincode").notEmpty().withMessage("Pincode is required"),
];

// Admin
router.get("/all", protect, authorize("admin"), getAllBookings);

// Customer/Provider — own bookings
router.get("/my", protect, getMyBookings);

// Customer — Pre-booking checkout order (Site visit fee Razorpay order generation)
router.post(
  "/checkout-order",
  protect,
  authorize("customer"),
  [
    body("providerId").notEmpty().isMongoId().withMessage("Valid provider ID required"),
    body("serviceId").notEmpty().isMongoId().withMessage("Valid service ID required"),
    body("scheduledDate").notEmpty().withMessage("Scheduled date is required"),
    validate,
  ],
  createCheckoutOrder
);

// Customer — Verify Razorpay payment and create confirmed booking atomically
router.post(
  "/verify-and-create",
  protect,
  authorize("customer"),
  uploadMultiple,
  [
    body("razorpayOrderId").notEmpty().withMessage("Razorpay Order ID is required"),
    body("razorpayPaymentId").notEmpty().withMessage("Razorpay Payment ID is required"),
    validate,
  ],
  verifyAndCreateBooking
);

// Customer — create booking (requires pre-payment details or admin)
router.post(
  "/",
  protect,
  authorize("customer", "admin"),
  uploadMultiple,
  createBookingRules,
  validate,
  createBooking
);

// Specific booking
router.get("/:id", protect, getBookingById);

// Provider / Admin — update status
router.patch(
  "/:id/status",
  protect,
  authorize("provider", "admin"),
  [body("status").notEmpty().withMessage("Status is required"), validate],
  updateBookingStatus
);

// Customer / Admin — cancel
router.patch("/:id/cancel", protect, authorize("customer", "admin"), cancelBooking);

// Razorpay — Create order for Site Visit / Consultation Fee
router.post("/:id/create-order", protect, authorize("customer"), createConsultationOrder);

// Razorpay — Verify payment signature for Site Visit / Consultation Fee
router.post(
  "/:id/verify-payment",
  protect,
  authorize("customer"),
  [
    body("razorpayOrderId").notEmpty().withMessage("Razorpay Order ID is required"),
    body("razorpayPaymentId").notEmpty().withMessage("Razorpay Payment ID is required"),
    validate,
  ],
  verifyConsultationPayment
);

// Provider — Complete Site Visit (when arrived)
router.patch("/:id/complete-visit", protect, authorize("provider"), completeSiteVisit);

// Customer — Record Decision (PROCEED | NOT_PROCEED)
router.patch(
  "/:id/decision",
  protect,
  authorize("customer"),
  [body("decision").isIn(["PROCEED", "NOT_PROCEED"]).withMessage("Decision must be 'PROCEED' or 'NOT_PROCEED'"), validate],
  recordCustomerDecision
);

// Customer — payment fallback
router.post("/:id/pay", protect, authorize("customer"), processPayment);

// Provider — upload before/after images
router.post(
  "/:id/work-images",
  protect,
  authorize("provider"),
  uploadMultiple,
  uploadWorkImages
);

module.exports = router;
