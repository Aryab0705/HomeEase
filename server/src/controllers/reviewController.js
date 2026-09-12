const mongoose = require("mongoose");
const Review = require("../models/Review");
const { RATING_CATEGORIES, ratingExpr } = require("../models/Review");
const { Booking } = require("../models/Booking");
const { Provider } = require("../models/Provider");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { uploadToCloudinary } = require("../services/cloudinaryService");
const Notification = require("../models/Notification");

/** Fields safe to expose about a reviewer on a PUBLIC provider profile. */
const PUBLIC_CUSTOMER_FIELDS = "name avatar";

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const round2 = (n) => (typeof n === "number" ? Math.round(n * 100) / 100 : 0);

const clampPagination = ({ page, limit }) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  return { page: p, limit: l, skip: (p - 1) * l };
};

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The rating a review contributes to the provider's average.
 *
 * Prefers the current `overallRating` path and falls back to the legacy
 * top-level `rating` field used by older documents, so historical reviews keep
 * counting instead of silently averaging as null.
 */
const OVERALL_EXPR = { $ifNull: ["$overallRating", "$rating"] };

/** Counts reviews whose rounded overall rating equals `star`. */
const starBucket = (star) => ({
  $sum: { $cond: [{ $eq: [{ $round: [OVERALL_EXPR, 0] }, star] }, 1, 0] },
});

/**
 * Computes a provider's public reputation directly from the reviews stored in
 * MongoDB. Nothing here is ever taken from the client.
 */
const computeProviderRating = async (providerId) => {
  const [agg] = await Review.aggregate([
    {
      $match: {
        providerId: toObjectId(providerId),
        isVisible: true,
        // Only reviews that actually carry a usable overall score, so the
        // distribution buckets always sum to totalReviews and the average is
        // taken over exactly the same set of documents.
        $or: [
          { overallRating: { $type: "number" } },
          { rating: { $type: "number" } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        average: { $avg: OVERALL_EXPR },
        workQuality: { $avg: ratingExpr("workQuality") },
        punctuality: { $avg: ratingExpr("punctuality") },
        professionalism: { $avg: ratingExpr("professionalism") },
        valueForMoney: { $avg: ratingExpr("valueForMoney") },
        star5: starBucket(5),
        star4: starBucket(4),
        star3: starBucket(3),
        star2: starBucket(2),
        star1: starBucket(1),
      },
    },
  ]);


  // No visible reviews -> a genuine zero state, not "leave the old value".
  if (!agg) {
    return {
      average: 0,
      totalReviews: 0,
      workQuality: 0,
      punctuality: 0,
      professionalism: 0,
      valueForMoney: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }

  return {
    average: round2(agg.average),
    totalReviews: agg.totalReviews,
    workQuality: round2(agg.workQuality),
    punctuality: round2(agg.punctuality),
    professionalism: round2(agg.professionalism),
    valueForMoney: round2(agg.valueForMoney),
    distribution: {
      5: agg.star5,
      4: agg.star4,
      3: agg.star3,
      2: agg.star2,
      1: agg.star1,
    },
  };
};

/**
 * Recalculates and PERSISTS the provider's aggregate rating.
 * Legacy mirror fields (quality/timeliness/communication) are kept in sync so
 * any older UI reading those paths keeps working.
 */
const recalcProviderRating = async (providerId) => {
  const rating = await computeProviderRating(providerId);

  await Provider.findByIdAndUpdate(providerId, {
    $set: {
      "rating.average": rating.average,
      "rating.totalReviews": rating.totalReviews,
      "rating.workQuality": rating.workQuality,
      "rating.punctuality": rating.punctuality,
      "rating.professionalism": rating.professionalism,
      "rating.valueForMoney": rating.valueForMoney,
      // legacy mirrors
      "rating.quality": rating.workQuality,
      "rating.timeliness": rating.punctuality,
    },
  });

  return rating;
};

/**
 * Broadcasts a new review over the EXISTING Socket.IO instance
 * (attached in server.js via `app.set("io", io)`). No second socket system.
 */
const broadcastReview = (req, { review, rating, providerId, providerUserId, bookingId }) => {
  const io = req.app.get("io");
  if (!io) return;

  const payload = {
    providerId: String(providerId),
    bookingId: String(bookingId),
    review,
    // Send the WHOLE recalculated aggregate. Listeners merge this shallowly, so
    // trimming it to average/totalReviews left the star distribution and the
    // four category averages showing pre-review numbers until a manual reload.
    rating,
  };

  // Anyone currently viewing this provider's profile / dashboard.
  io.to(`provider:${providerId}`).emit("review:created", payload);
  io.to(`provider:${providerId}`).emit("provider:ratingUpdated", {
    providerId: String(providerId),
    rating,
  });

  // The provider's own personal room (dashboard, notification bell).
  if (providerUserId) {
    io.to(`user:${providerUserId}`).emit("review:created", payload);
    io.to(`user:${providerUserId}`).emit("provider:ratingUpdated", {
      providerId: String(providerId),
      rating,
    });
  }

  // Anyone on the booking detail page for this job.
  io.to(`booking:${bookingId}`).emit("review:created", payload);
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/reviews
// @access  Private/Customer
// ─────────────────────────────────────────────────────────────────────────────
const createReview = asyncHandler(async (req, res) => {
  const { bookingId, ratings, comment } = req.body;
  // NOTE: overallRating is intentionally NOT taken from the body.
  // The Review model's pre-validate hook computes it server-side as:
  // (workQuality + punctuality + professionalism + valueForMoney) / 4

  // ── Authorisation gate ─────────────────────────────────────────────────────
  // Every check below uses req.user / the stored booking. Nothing identifying
  // is trusted from the request body (normalizeReviewPayload already stripped
  // customerId / providerId).
  const booking = await Booking.findById(bookingId).select(
    "customerId providerId status isReviewed"
  );

  if (!booking) throw new ApiError(404, "Booking not found.");

  if (String(booking.customerId) !== String(req.user._id)) {
    throw new ApiError(403, "You can only review your own bookings.");
  }

  if (booking.status !== "completed") {
    throw new ApiError(
      400,
      "You can only review a booking once the service is marked completed."
    );
  }

  if (!booking.providerId) {
    throw new ApiError(409, "This booking has no provider assigned.");
  }

  // The Review collection is the source of truth for duplicates — the
  // booking.isReviewed flag is only a denormalised hint and can drift.
  const existing = await Review.exists({ bookingId: booking._id });
  if (existing) {
    throw new ApiError(409, "You have already reviewed this booking.");
  }

  // ── Optional images ────────────────────────────────────────────────────────
  let images = [];
  if (req.files && req.files.length > 0) {
    const uploads = await Promise.all(
      req.files.map((f) => uploadToCloudinary(f.buffer, "reviews"))
    );
    images = uploads.map((r) => ({ url: r.secure_url, publicId: r.public_id }));
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  let review;
  try {
    review = await Review.create({
      bookingId: booking._id,
      customerId: req.user._id, // from the verified JWT, never the body
      providerId: booking.providerId, // from the booking, never the body
      // overallRating is computed by the model's pre-validate hook
      ratings: {
        workQuality: ratings.workQuality,
        punctuality: ratings.punctuality,
        professionalism: ratings.professionalism,
        valueForMoney: ratings.valueForMoney,
      },
      comment,
      images,
    });
  } catch (err) {
    // Unique index on bookingId — the race-proof duplicate guard.
    if (err?.code === 11000) {
      throw new ApiError(409, "You have already reviewed this booking.");
    }
    throw err;
  }

  // Denormalised flag so booking lists can hide "Write a Review" cheaply.
  await Booking.findByIdAndUpdate(booking._id, { $set: { isReviewed: true } });

  // ── Recalculate the provider's public reputation from real data ────────────
  const rating = await recalcProviderRating(booking.providerId);

  await review.populate("customerId", PUBLIC_CUSTOMER_FIELDS);

  // ── Notify + broadcast (never let these break a successful submission) ─────
  const providerDoc = await Provider.findById(booking.providerId).select("userId");
  const providerUserId = providerDoc?.userId ? String(providerDoc.userId) : null;

  try {
    if (providerUserId) {
      await Notification.create({
        userId: providerUserId,
        title: "New Review Received",
        message: `You received a ${review.overallRating}-star review.`,
        type: "review_received",
        relatedId: review._id,
        relatedModel: "Review",
      });
    }
  } catch (err) {
    console.error("Review notification failed (review was saved):", err.message);
  }

  try {
    broadcastReview(req, {
      review: review.toJSON(),
      rating,
      providerId: booking.providerId,
      providerUserId,
      bookingId: booking._id,
    });
  } catch (err) {
    console.error("Review socket broadcast failed (review was saved):", err.message);
  }

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { review, rating },
        "Review submitted successfully."
      )
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/reviews/provider/:providerId
// @access  Public — this IS the provider's public reputation
// ─────────────────────────────────────────────────────────────────────────────
const getProviderReviews = asyncHandler(async (req, res) => {
  const { providerId } = req.params;
  const { page, limit, skip } = clampPagination(req.query);

  const filter = { providerId: toObjectId(providerId), isVisible: true };

  const [reviews, total, rating] = await Promise.all([
    Review.find(filter)
      // Only public-safe customer fields — never phone/email/address.
      .populate("customerId", PUBLIC_CUSTOMER_FIELDS)
      .select("-images.publicId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
    computeProviderRating(providerId),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      reviews,
      rating,
      // `summary` retained for backwards compatibility with existing callers.
      summary: {
        avgOverall: rating.average,
        totalReviews: rating.totalReviews,
        avgQuality: rating.workQuality,
        avgPunctuality: rating.punctuality,
        avgProfessionalism: rating.professionalism,
        avgValueForMoney: rating.valueForMoney,
        count5: rating.distribution[5],
        count4: rating.distribution[4],
        count3: rating.distribution[3],
        count2: rating.distribution[2],
        count1: rating.distribution[1],
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 0,
      },
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/reviews/my
// @access  Private/Customer
// ─────────────────────────────────────────────────────────────────────────────
const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ customerId: req.user._id })
    .populate({
      path: "providerId",
      select: "userId primaryCategory rating",
      populate: { path: "userId", select: PUBLIC_CUSTOMER_FIELDS },
    })
    .populate("bookingId", "serviceId scheduledDate status")
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json(new ApiResponse(200, reviews));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/reviews/booking/:bookingId
// @access  Private — booking's customer, its provider, or an admin
// ─────────────────────────────────────────────────────────────────────────────
const getReviewForBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId).select("customerId providerId");
  if (!booking) throw new ApiError(404, "Booking not found.");

  const role = req.user.role;
  let allowed = role === "admin" || role === "super_admin";

  if (!allowed && String(booking.customerId) === String(req.user._id)) {
    allowed = true;
  }

  if (!allowed && role === "provider") {
    const provider = await Provider.findOne({ userId: req.user._id }).select("_id");
    allowed = !!provider && String(booking.providerId) === String(provider._id);
  }

  if (!allowed) throw new ApiError(403, "Not authorized to view this review.");

  const review = await Review.findOne({ bookingId })
    .populate("customerId", PUBLIC_CUSTOMER_FIELDS)
    .lean();

  // A missing review is a normal state, not an error — the client uses this to
  // decide whether to show "Write a Review".
  res.status(200).json(new ApiResponse(200, { review: review || null }));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/reviews/:id/respond
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const respondToReview = asyncHandler(async (req, res) => {
  const { comment } = req.body;

  const review = await Review.findById(req.params.id).select("providerId");
  if (!review) throw new ApiError(404, "Review not found.");

  const provider = await Provider.findOne({ userId: req.user._id }).select("_id");
  if (!provider || String(review.providerId) !== String(provider._id)) {
    throw new ApiError(403, "You can only respond to reviews on your own profile.");
  }

  // findByIdAndUpdate (not .save()) so pre-existing reviews written under the
  // older schema are not re-validated against the current required fields.
  const updated = await Review.findByIdAndUpdate(
    req.params.id,
    { $set: { providerResponse: { comment, respondedAt: new Date() } } },
    { new: true }
  ).populate("customerId", PUBLIC_CUSTOMER_FIELDS);

  res.status(200).json(new ApiResponse(200, updated, "Response added."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/reviews/:id/visibility
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const toggleReviewVisibility = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id).select("isVisible providerId");
  if (!review) throw new ApiError(404, "Review not found.");

  const nextVisible = !review.isVisible;

  await Review.findByIdAndUpdate(req.params.id, { $set: { isVisible: nextVisible } });

  // Hiding or restoring a review changes the provider's public average.
  const rating = await recalcProviderRating(review.providerId);

  // Best-effort broadcast: the visibility change is already persisted, so a
  // socket failure must not turn a successful write into a 500.
  try {
    const io = req.app.get("io");
    if (io) {
      io.to(`provider:${review.providerId}`).emit("provider:ratingUpdated", {
        providerId: String(review.providerId),
        rating,
      });
    }
  } catch (err) {
    console.error("[review visibility broadcast failed]", err);
  }

  res.status(200).json(
    new ApiResponse(
      200,
      { isVisible: nextVisible, rating },
      `Review ${nextVisible ? "shown" : "hidden"}.`
    )
  );
});

module.exports = {
  createReview,
  getProviderReviews,
  getMyReviews,
  getReviewForBooking,
  respondToReview,
  toggleReviewVisibility,
  // exported for reuse / tests
  recalcProviderRating,
  computeProviderRating,
  RATING_CATEGORIES,
};
