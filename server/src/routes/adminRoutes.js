const express = require("express");
const router = express.Router();

const { 
  getAnalytics, getPendingProviders, getAdminProviders, getAdminUsers,
  getDashboardStats, getAdminBookings, getAdminRevenue,
  getAdminComplaints, updateComplaintStatus, getAdminReviews,
  getActivityLog, globalSearch, getAdminPayments,
  createService, updateService, toggleServiceStatus,
  getVerificationRequests, sendAdminNotification,
  getAdmins, createAdminAccount, toggleAdminBlock,
  getProviderVerificationDetail, adminVerifyCategory,
} = require("../controllers/adminController");
const { toggleBlockUser, deleteUser } = require("../controllers/userController");
const { verifyProvider } = require("../controllers/providerController");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const { isAdmin, isSuperAdmin } = require("../middleware/roleCheck");

// All admin routes require auth + admin or super_admin role
router.use(protect, isAdmin);

// Core Admin Routes
router.get("/dashboard", getDashboardStats);
router.get("/bookings", getAdminBookings);
router.get("/revenue", getAdminRevenue);
router.get("/complaints", getAdminComplaints);
router.patch("/complaints/:id", updateComplaintStatus);
router.get("/reviews", getAdminReviews);
router.get("/activity", getActivityLog);
router.get("/search", globalSearch);

// Users & Providers Management
router.get("/analytics", getAnalytics);
router.get("/users", getAdminUsers);
router.get("/providers", getAdminProviders);
router.get("/providers/pending", getPendingProviders);
router.get("/verification/requests", getVerificationRequests);
router.put("/users/:id/block", toggleBlockUser);
router.delete("/users/:id", deleteUser);
router.patch(
  "/providers/:id/verify",
  [body("status").isIn(["verified", "rejected", "pending", "under_review"]).withMessage("Invalid status"), validate],
  verifyProvider
);
router.get("/providers/:id/verification", getProviderVerificationDetail);
router.patch("/providers/:id/verify-category", adminVerifyCategory);

// Payments & Transactions
router.get("/payments", getAdminPayments);

// Services & Categories Management
router.post("/services", createService);
router.put("/services/:id", updateService);
router.patch("/services/:id/toggle", toggleServiceStatus);

// Notifications & Announcements
router.post("/notifications/broadcast", sendAdminNotification);

// ── Super Admin Only Routes ────────────────────────────────────────────────
router.get("/admins", isSuperAdmin, getAdmins);
router.post(
  "/admins",
  isSuperAdmin,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    validate,
  ],
  createAdminAccount
);
router.put("/admins/:id/block", isSuperAdmin, toggleAdminBlock);

module.exports = router;
