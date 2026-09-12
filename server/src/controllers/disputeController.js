const Dispute = require("../models/Dispute");
const { Booking } = require("../models/Booking");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { uploadToCloudinary } = require("../services/cloudinaryService");

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/disputes
// @access  Private/Customer
// ─────────────────────────────────────────────────────────────────────────────
const createDispute = asyncHandler(async (req, res) => {
  const { bookingId, reason, category } = req.body;

  const booking = await Booking.findById(bookingId).populate({
    path: "providerId",
    populate: { path: "userId", select: "_id" },
  });
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.customerId.toString() !== req.user._id.toString())
    throw new ApiError(403, "Not authorized.");

  // Check if dispute already exists for this booking
  const existing = await Dispute.findOne({ bookingId });
  if (existing) throw new ApiError(409, "A dispute already exists for this booking.");

  let evidenceImages = [];
  if (req.files && req.files.length > 0) {
    const uploads = await Promise.all(
      req.files.map((f) => uploadToCloudinary(f.buffer, "disputes"))
    );
    evidenceImages = uploads.map((r) => ({ url: r.secure_url, publicId: r.public_id }));
  }

  const dispute = await Dispute.create({
    bookingId,
    raisedBy: req.user._id,
    raisedAgainst: booking.providerId.userId._id,
    reason,
    category,
    evidenceImages,
  });

  res.status(201).json(new ApiResponse(201, dispute, "Dispute raised successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/disputes/my
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMyDisputes = asyncHandler(async (req, res) => {
  const disputes = await Dispute.find({ raisedBy: req.user._id })
    .populate("bookingId", "status scheduledDate")
    .sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, disputes));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/disputes  (Admin)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const getAllDisputes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const query = status ? { status } : {};

  const disputes = await Dispute.find(query)
    .populate("raisedBy", "name email")
    .populate("raisedAgainst", "name email")
    .populate("bookingId", "status scheduledDate")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Dispute.countDocuments(query);

  res.status(200).json(
    new ApiResponse(200, {
      disputes,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/disputes/:id/resolve  (Admin)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const resolveDispute = asyncHandler(async (req, res) => {
  const { resolution, status, adminNotes } = req.body;

  const dispute = await Dispute.findById(req.params.id);
  if (!dispute) throw new ApiError(404, "Dispute not found.");

  dispute.status = status || "resolved";
  dispute.resolution = resolution;
  dispute.adminNotes = adminNotes;
  dispute.resolvedBy = req.user._id;
  dispute.resolvedAt = new Date();

  await dispute.save();

  res.status(200).json(new ApiResponse(200, dispute, "Dispute resolved."));
});

module.exports = { createDispute, getMyDisputes, getAllDisputes, resolveDispute };
