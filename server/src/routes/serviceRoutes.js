const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} = require("../controllers/serviceController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validate } = require("../middleware/validate");
const { uploadSingle } = require("../middleware/upload");

const serviceRules = [
  body("name").trim().notEmpty().withMessage("Service name is required"),
  body("category").notEmpty().withMessage("Category is required"),
  body("basePrice").isNumeric().withMessage("Base price must be a number"),
];

// Public
router.get("/", getServices);
router.get("/:id", getServiceById);

// Admin only
router.post("/", protect, authorize("admin"), uploadSingle, serviceRules, validate, createService);
router.put("/:id", protect, authorize("admin"), uploadSingle, updateService);
router.delete("/:id", protect, authorize("admin"), deleteService);

module.exports = router;
