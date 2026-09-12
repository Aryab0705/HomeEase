const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const {
  createDispute,
  getMyDisputes,
  getAllDisputes,
  resolveDispute,
} = require("../controllers/disputeController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validate } = require("../middleware/validate");
const { uploadMultiple } = require("../middleware/upload");

const disputeRules = [
  body("bookingId").notEmpty().isMongoId().withMessage("Valid booking ID required"),
  body("reason").notEmpty().withMessage("Reason is required"),
];

router.post("/", protect, authorize("customer"), uploadMultiple, disputeRules, validate, createDispute);
router.get("/my", protect, getMyDisputes);
router.get("/", protect, authorize("admin"), getAllDisputes);
router.patch("/:id/resolve", protect, authorize("admin"), resolveDispute);

module.exports = router;
