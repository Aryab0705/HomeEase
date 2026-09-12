const Quote = require("../models/Quote");
const { Booking } = require("../models/Booking");
const { Provider } = require("../models/Provider");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const Notification = require("../models/Notification");

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/quotes
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const submitQuote = asyncHandler(async (req, res) => {
  const { bookingId, estimatedCost, estimatedDuration, notes } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.status !== "pending") throw new ApiError(400, "Booking is not open for quotes.");

  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  // Prevent duplicate quote from same provider
  const existing = await Quote.findOne({ bookingId, providerId: provider._id });
  if (existing) throw new ApiError(409, "You have already submitted a quote for this booking.");

  const quote = await Quote.create({
    bookingId,
    providerId: provider._id,
    customerId: booking.customerId,
    estimatedCost,
    estimatedDuration,
    notes,
  });

  // Notify customer
  await Notification.create({
    userId: booking.customerId,
    title: "New Quote Received",
    message: `A provider submitted a quote of ₹${estimatedCost} for your booking.`,
    type: "quote_received",
    relatedId: quote._id,
    relatedModel: "Quote",
  });

  res.status(201).json(new ApiResponse(201, quote, "Quote submitted successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/quotes/booking/:bookingId
// @access  Private/Customer
// ─────────────────────────────────────────────────────────────────────────────
const getQuotesForBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.customerId.toString() !== req.user._id.toString())
    throw new ApiError(403, "Not authorized.");

  const quotes = await Quote.find({ bookingId: req.params.bookingId })
    .populate({
      path: "providerId",
      populate: { path: "userId", select: "name avatar phone" },
    })
    .sort({ estimatedCost: 1 });

  res.status(200).json(new ApiResponse(200, quotes));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/quotes/:id/accept
// @access  Private/Customer
// ─────────────────────────────────────────────────────────────────────────────
const acceptQuote = asyncHandler(async (req, res) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw new ApiError(404, "Quote not found.");
  if (quote.customerId.toString() !== req.user._id.toString())
    throw new ApiError(403, "Not authorized.");
  if (quote.status !== "submitted") throw new ApiError(400, "Quote is no longer available.");

  // Accept this quote
  quote.status = "accepted";
  quote.acceptedAt = new Date();
  await quote.save();

  // Reject all other quotes for this booking
  await Quote.updateMany(
    { bookingId: quote.bookingId, _id: { $ne: quote._id } },
    { status: "rejected" }
  );

  // Update booking with selected provider and amount
  await Booking.findByIdAndUpdate(quote.bookingId, {
    providerId: quote.providerId,
    totalAmount: quote.estimatedCost,
    status: "accepted",
    $push: { statusHistory: { status: "accepted", note: "Quote accepted by customer." } },
  });

  res.status(200).json(new ApiResponse(200, quote, "Quote accepted."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/quotes/my
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const getMyQuotes = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  const quotes = await Quote.find({ providerId: provider._id })
    .populate("bookingId", "status scheduledDate serviceId address")
    .populate("customerId", "name avatar phone")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, quotes));
});

module.exports = { submitQuote, getQuotesForBooking, acceptQuote, getMyQuotes };
