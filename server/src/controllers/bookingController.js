const { Booking, BOOKING_STATUS } = require("../models/Booking");
const { Provider } = require("../models/Provider");
const Service = require("../models/Service");
const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { uploadToCloudinary } = require("../services/cloudinaryService");
const { checkProviderAvailability } = require("../utils/availabilityHelper");
const { createOrder, verifyPaymentSignature, getKeyId } = require("../services/razorpayService");
const { settleToProvider, refundToCustomer } = require("../services/settlementService");
const Payment = require("../models/Payment");

// Helper — push a notification
const notify = async (userId, title, message, type, relatedId, relatedModel) => {
  await Notification.create({ userId, title, message, type, relatedId, relatedModel });
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper — validate provider, service, availability and calculate consultation fee
async function validateBookingAndCalculateFee({ providerId, serviceId, scheduledDate, scheduledTimeSlot }) {
  const [provider, service] = await Promise.all([
    Provider.findById(providerId).populate("userId", "name email phone avatar"),
    Service.findById(serviceId),
  ]);

  if (!provider) throw new ApiError(404, "Provider not found.");
  if (!service) throw new ApiError(404, "Service not found.");
  if (
    provider.verificationStatus !== "verified" ||
    provider.verification?.overallStatus !== "verified" ||
    provider.status !== "approved" ||
    !provider.isActive
  ) {
    throw new ApiError(400, "Provider is not verified or approved for bookings.");
  }
  if (provider.availability && provider.availability.isAvailable === false)
    throw new ApiError(400, "Provider is not currently available.");

  const availCheck = checkProviderAvailability(provider, scheduledDate, scheduledTimeSlot);
  if (!availCheck.available) {
    throw new ApiError(400, availCheck.message);
  }

  const offeredCategories = [
    provider.primaryCategory,
    ...(provider.subCategories || []),
    ...(provider.services || []).map((s) => s.category),
  ].filter(Boolean);

  if (!offeredCategories.includes(service.category)) {
    throw new ApiError(
      400,
      `This provider (${provider.primaryCategory}) does not offer '${service.category}' services.`
    );
  }

  const providerServiceItem = (provider.services || []).find(
    (s) =>
      (s.category && service.category && s.category.toLowerCase() === service.category.toLowerCase()) ||
      (s.name && service.name && s.name.toLowerCase() === service.name.toLowerCase())
  ) || (provider.services && provider.services[0]);

  const providerBasePrice =
    provider.siteVisitFee ||
    provider.consultationFee ||
    providerServiceItem?.basePrice ||
    provider.startingPrice ||
    provider.hourlyRate ||
    service.basePrice;

  if (!providerBasePrice || Number(providerBasePrice) <= 0) {
    throw new ApiError(400, "Unable to determine a valid site visit fee for this provider and service.");
  }
  const consultationFee = Number(providerBasePrice);

  return { provider, service, consultationFee };
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/bookings/checkout-order
// @access  Private/Customer — Generate Razorpay order for site visit fee before booking
// ─────────────────────────────────────────────────────────────────────────────
const createCheckoutOrder = asyncHandler(async (req, res) => {
  const { providerId, serviceId, scheduledDate, scheduledTimeSlot, address } = req.body;

  if (!providerId || !serviceId || !scheduledDate) {
    throw new ApiError(400, "Provider, service, and scheduled date are required.");
  }

  // Validate destination address details if sent
  if (address) {
    if (!address.street || !address.city || !address.state || !address.pincode) {
      throw new ApiError(400, "Complete destination address (street, city, state, pincode) is required.");
    }
  }

  const { provider, service, consultationFee } = await validateBookingAndCalculateFee({
    providerId,
    serviceId,
    scheduledDate,
    scheduledTimeSlot,
  });

  if (consultationFee <= 0) {
    throw new ApiError(400, "Invalid site visit fee amount.");
  }

  let order;
  try {
    order = await createOrder(consultationFee, `chk_${Date.now()}`, {
      customerId: req.user._id.toString(),
      providerId: provider._id.toString(),
      serviceId: service._id.toString(),
      type: "site_visit_fee",
      serviceName: service.name,
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    throw new ApiError(
      502,
      `Razorpay payment gateway error: ${err.error?.description || err.message || "Failed to create payment order"}`
    );
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.id,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency || "INR",
        keyId: order.keyId,
        key_id: order.keyId,
        isMock: Boolean(order.isMock),
        consultationFee,
        service: {
          id: service._id,
          name: service.name,
          category: service.category,
        },
        provider: {
          id: provider._id,
          name: provider.userId?.name || "Provider",
        },
      },
      "Checkout order created successfully."
    )
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/bookings/verify-and-create
// @access  Private/Customer — Verify Razorpay payment and create confirmed booking
// ─────────────────────────────────────────────────────────────────────────────
const verifyAndCreateBooking = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const bookingData = req.body.bookingData || req.body;

  if (!razorpayOrderId || !razorpayPaymentId) {
    throw new ApiError(400, "Razorpay order ID and payment ID are required.");
  }

  const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    throw new ApiError(400, "Invalid payment signature verification failed.");
  }

  // Idempotency: check if payment already created
  const existingPayment = await Payment.findOne({ razorpayPaymentId });
  if (existingPayment) {
    const existingBooking = await Booking.findById(existingPayment.bookingId)
      .populate("customerId", "name email phone avatar")
      .populate({ path: "providerId", populate: { path: "userId", select: "name email phone avatar" } })
      .populate("serviceId", "name category basePrice");
    if (existingBooking) {
      return res.status(200).json(new ApiResponse(200, existingBooking, "Booking already created."));
    }
  }

  const {
    providerId,
    serviceId,
    scheduledDate,
    scheduledTimeSlot,
    address,
    customerLocation,
    problemDescription,
    isEmergency,
  } = bookingData;

  const { provider, service, consultationFee } = await validateBookingAndCalculateFee({
    providerId,
    serviceId,
    scheduledDate,
    scheduledTimeSlot,
  });

  // Upload problem images if provided
  let problemImages = [];
  if (req.files && req.files.length > 0) {
    const uploads = await Promise.all(
      req.files.map((f) => uploadToCloudinary(f.buffer, "booking-problems"))
    );
    problemImages = uploads.map((r) => ({ url: r.secure_url, publicId: r.public_id }));
  }

  const custLoc = (customerLocation && customerLocation.latitude != null && customerLocation.longitude != null)
    ? { latitude: Number(customerLocation.latitude), longitude: Number(customerLocation.longitude) }
    : (address?.coordinates?.lat != null && address?.coordinates?.lng != null)
    ? { latitude: Number(address.coordinates.lat), longitude: Number(address.coordinates.lng) }
    : null;

  const booking = await Booking.create({
    customerId: req.user._id,
    providerId: provider._id,
    serviceId: service._id,
    scheduledDate: new Date(scheduledDate),
    scheduledTimeSlot,
    address,
    customerLocation: custLoc,
    problemDescription,
    problemImages,
    siteVisitFee: consultationFee,
    consultationFee,
    estimatedAmount: consultationFee,
    totalAmount: consultationFee,
    pricing: {
      consultationFee,
      consultationFeePaid: true,
      consultationFeeRefunded: false,
      finalQuotation: null,
      creditedFee: 0,
      remainingAmount: null,
      quoteStatus: "none",
      finalPaymentPaid: false,
    },
    status: "pending",
    paymentStatus: "paid",
    settlementStatus: "PENDING",
    isEmergency: isEmergency || false,
    statusHistory: [
      {
        status: "pending",
        note: `Booking confirmed with pre-paid Site Visit / Consultation Fee of ₹${consultationFee}.`,
      },
    ],
  });

  const payment = await Payment.create({
    bookingId: booking._id,
    customerId: req.user._id,
    providerId: provider._id,
    amount: consultationFee,
    currency: "INR",
    method: "razorpay",
    status: "success",
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature: razorpaySignature || "mock_signature",
    paidAt: new Date(),
    notes: "Site Visit / Consultation Fee pre-paid via Razorpay before booking confirmation",
  });

  booking.paymentId = payment._id;
  await booking.save();

  // Notify provider
  await notify(
    provider.userId._id || provider.userId,
    "New Paid Booking Request",
    `You have a new booking request for ${service.name}. Site visit fee of ₹${consultationFee} is pre-paid.`,
    "booking_request",
    booking._id,
    "Booking"
  );

  const io = req.app.get("io");
  if (io) {
    const payload = {
      bookingId: booking._id.toString(),
      status: booking.status,
      updatedAt: booking.updatedAt,
      booking,
    };
    io.to(`user:${provider.userId._id || provider.userId}`).emit("booking:created", payload);
  }

  const populated = await Booking.findById(booking._id)
    .populate("customerId", "name email phone avatar")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email phone avatar" } })
    .populate("serviceId", "name category basePrice");

  res.status(201).json(new ApiResponse(201, populated, "Booking confirmed and created successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/bookings
// @access  Private/Customer
// ─────────────────────────────────────────────────────────────────────────────
const createBooking = asyncHandler(async (req, res) => {
  // If payment tokens are provided in the payload, delegate to verifyAndCreateBooking
  if (req.body.razorpayOrderId && req.body.razorpayPaymentId) {
    return verifyAndCreateBooking(req, res);
  }

  // Only admin may bypass upfront payment for manual operations
  if (req.user.role !== "admin") {
    throw new ApiError(
      402,
      "Payment of Site Visit / Consultation Fee is mandatory before booking confirmation. Please use /checkout-order and /verify-and-create."
    );
  }

  const {
    providerId,
    serviceId,
    scheduledDate,
    scheduledTimeSlot,
    address,
    customerLocation,
    problemDescription,
    isEmergency,
    proposedAmount,
    proposalMessage,
  } = req.body;

  const { provider, service, consultationFee } = await validateBookingAndCalculateFee({
    providerId,
    serviceId,
    scheduledDate,
    scheduledTimeSlot,
  });

  // Upload problem images if provided
  let problemImages = [];
  if (req.files && req.files.length > 0) {
    const uploads = await Promise.all(
      req.files.map((f) => uploadToCloudinary(f.buffer, "booking-problems"))
    );
    problemImages = uploads.map((r) => ({ url: r.secure_url, publicId: r.public_id }));
  }

  const custLoc = (customerLocation && customerLocation.latitude != null && customerLocation.longitude != null)
    ? { latitude: Number(customerLocation.latitude), longitude: Number(customerLocation.longitude) }
    : (address?.coordinates?.lat != null && address?.coordinates?.lng != null)
    ? { latitude: Number(address.coordinates.lat), longitude: Number(address.coordinates.lng) }
    : null;

  const booking = await Booking.create({
    customerId: req.user._id,
    providerId: provider._id,
    serviceId: service._id,
    scheduledDate: new Date(scheduledDate),
    scheduledTimeSlot,
    address,
    customerLocation: custLoc,
    problemDescription,
    problemImages,
    siteVisitFee: consultationFee,
    consultationFee,
    estimatedAmount: consultationFee,
    totalAmount: consultationFee,
    pricing: {
      consultationFee,
      consultationFeePaid: false,
      consultationFeeRefunded: false,
      finalQuotation: null,
      creditedFee: 0,
      remainingAmount: null,
      quoteStatus: "none",
      finalPaymentPaid: false,
    },
    paymentStatus: "unpaid",
    settlementStatus: "PENDING",
    isEmergency: isEmergency || false,
    statusHistory: [{ status: "pending", note: `Booking created by admin. Site visit / consultation fee: ₹${consultationFee}.` }],
  });

  await notify(
    provider.userId._id || provider.userId,
    "New Booking Request",
    `You have a new booking request for ${service.name}.`,
    "booking_request",
    booking._id,
    "Booking"
  );

  const populated = await Booking.findById(booking._id)
    .populate("customerId", "name email phone avatar")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email phone avatar" } })
    .populate("serviceId", "name category basePrice");

  res.status(201).json(new ApiResponse(201, populated, "Booking created successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/bookings/my
// @access  Private — returns bookings for logged-in user (customer or provider)
// ─────────────────────────────────────────────────────────────────────────────
const getMyBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  let query = {};

  if (req.user.role === "customer") {
    query.customerId = req.user._id;
  } else if (req.user.role === "provider") {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider) throw new ApiError(404, "Provider profile not found.");
    query.providerId = provider._id;
  }

  if (status) {
    if (status.includes(",")) {
      query.status = { $in: status.split(",").map((s) => s.trim()) };
    } else {
      query.status = status;
    }
  }

  const bookings = await Booking.find(query)
    .populate("customerId", "name email phone avatar")
    .populate("providerId")
    .populate("serviceId", "name category basePrice icon")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Booking.countDocuments(query);

  res.status(200).json(
    new ApiResponse(200, {
      bookings,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/bookings/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("customerId", "name email phone avatar")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email phone avatar" } })
    .populate("serviceId", "name category basePrice icon");

  if (!booking) throw new ApiError(404, "Booking not found.");

  // Access control — only involved parties or admin can view
  const isCustomer = booking.customerId._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  let isProvider = false;
  if (req.user.role === "provider") {
    const provider = await Provider.findOne({ userId: req.user._id });
    isProvider = provider && booking.providerId._id.toString() === provider._id.toString();
  }

  if (!isCustomer && !isProvider && !isAdmin) {
    throw new ApiError(403, "Not authorized to view this booking.");
  }

  // If status is on_the_way and we have provider coordinates, evaluate geofence on fetch/refresh
  if (booking.status === "on_the_way" && booking.currentProviderLocation?.lat != null && booking.currentProviderLocation?.lng != null) {
    const { evaluateArrivalGeofence } = require("../utils/geoUtils");
    const { statusChanged } = await evaluateArrivalGeofence(
      booking,
      booking.currentProviderLocation.lat,
      booking.currentProviderLocation.lng,
      100
    );

    if (statusChanged && booking.status === "arrived") {
      const io = req.app.get("io");
      if (io) {
        const statusPayload = {
          bookingId: booking._id.toString(),
          status: "arrived",
          updatedAt: booking.updatedAt,
          booking,
          note: "Provider has arrived at destination",
        };
        io.to(`booking:${booking._id.toString()}`).emit("booking:statusUpdated", statusPayload);
        io.to(`user:${booking.customerId._id.toString()}`).emit("booking:statusUpdated", statusPayload);
      }
    }
  }

  res.status(200).json(new ApiResponse(200, booking));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/bookings/:id/status
// @access  Private/Provider or Admin
// ─────────────────────────────────────────────────────────────────────────────
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  if (!BOOKING_STATUS.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${BOOKING_STATUS.join(", ")}`);
  }

  const booking = await Booking.findById(req.params.id).populate("serviceId", "name");
  if (!booking) throw new ApiError(404, "Booking not found.");

  // Validate provider ownership for non-admins
  if (req.user.role === "provider") {
    const provider = await Provider.findOne({ userId: req.user._id });
    if (!provider || booking.providerId.toString() !== provider._id.toString()) {
      throw new ApiError(403, "Not authorized to update this booking. Only the assigned provider can update status.");
    }
  }

  // Validation for "on_the_way": Cannot start journey before scheduled time
  if (status === "on_the_way") {
    if (req.user.role !== "admin" && req.user.role !== "provider") {
      throw new ApiError(403, "Only the assigned provider can start the journey.");
    }

    // Check scheduled date and time
    const now = new Date();
    const schedDate = new Date(booking.scheduledDate);
    const startSlot = booking.scheduledTimeSlot?.start; // e.g. "10:00"

    let earliestStart = new Date(schedDate);
    if (startSlot && startSlot.includes(":")) {
      const [hours, minutes] = startSlot.split(":").map(Number);
      earliestStart.setHours(hours, minutes, 0, 0);
    } else {
      // Default to start of scheduled day
      earliestStart.setHours(0, 0, 0, 0);
    }

    if (now < earliestStart) {
      const formattedEarliest = earliestStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const formattedDate = earliestStart.toLocaleDateString();
      throw new ApiError(
        400,
        `Cannot start journey before scheduled time (${formattedDate} at ${formattedEarliest}). Future bookings must remain ACCEPTED until the scheduled date/time.`
      );
    }

    // Auto begin live GPS tracking
    booking.isLiveTracking = true;
  }

  // Status transition rules
  const allowedTransitions = {
    pending: ["accepted", "rejected", "cancelled"],
    accepted: ["on_the_way", "cancelled"],
    on_the_way: ["arrived", "cancelled"],
    arrived: ["site_visit_completed", "completed"],
    site_visit_completed: ["customer_decision", "settled"],
    customer_decision: ["settled"],
    settled: ["completed"],
    completed: [],
    rejected: [],
    cancelled: [],
  };

  if (!allowedTransitions[booking.status]?.includes(status)) {
    throw new ApiError(
      400,
      `Cannot transition from '${booking.status}' to '${status}'.`
    );
  }

  booking.status = status;
  booking.statusHistory.push({ status, note: note || "" });

  if (status === "completed") {
    booking.completedAt = new Date();
    // Only credit provider earnings if not already credited/settled (e.g. via settleToProvider)
    if (booking.settlementStatus !== "PROVIDER_EARNED") {
      const earnedAmount = Number(
        booking.siteVisitFee ||
        booking.consultationFee ||
        booking.pricing?.consultationFee ||
        booking.totalAmount ||
        booking.estimatedAmount ||
        0
      );
      booking.siteVisitFee = earnedAmount;
      booking.consultationFee = earnedAmount;
      booking.settlementStatus = "PROVIDER_EARNED";
      booking.settledAt = new Date();

      if (booking.providerId) {
        await Provider.findByIdAndUpdate(booking.providerId, {
          $inc: { completedJobs: 1, totalEarnings: earnedAmount },
        });
      }

      if (booking.paymentId) {
        await Payment.findByIdAndUpdate(booking.paymentId, {
          status: "settled_to_provider",
          settledAt: new Date(),
          notes: "Site visit fee credited on booking completion",
        });
      }
    }
  }

  if (status === "rejected") {
    await Provider.findByIdAndUpdate(booking.providerId, { $inc: { rejectedJobs: 1 } });
  }

  await booking.save();

  // Notify customer
  const notifMap = {
    accepted: { title: "Booking Accepted", msg: `Your booking for ${booking.serviceId?.name || 'service'} has been accepted.`, type: "booking_accepted" },
    rejected: { title: "Booking Rejected", msg: `Your booking for ${booking.serviceId?.name || 'service'} was rejected.`, type: "booking_rejected" },
    on_the_way: { title: "Provider On The Way", msg: "Your service provider is on the way.", type: "booking_status" },
    arrived: { title: "Provider Arrived", msg: "Your service provider has arrived.", type: "booking_status" },
    completed: { title: "Service Completed", msg: "Your service booking has been marked as completed.", type: "booking_completed" },
    cancelled: { title: "Booking Cancelled", msg: "Your booking has been cancelled.", type: "booking_cancelled" },
  };

  if (notifMap[status]) {
    await notify(booking.customerId, notifMap[status].title, notifMap[status].msg, notifMap[status].type, booking._id, "Booking");
  }

  // Real-time Socket.IO emission to booking room and customer user room
  const io = req.app.get("io");
  if (io) {
    const payload = {
      bookingId: booking._id.toString(),
      status: booking.status,
      updatedAt: booking.updatedAt,
      booking,
      note: note || "",
    };
    io.to(`booking:${booking._id.toString()}`).emit("booking:statusUpdated", payload);
    io.to(`user:${booking.customerId.toString()}`).emit("booking:statusUpdated", payload);
  }

  res.status(200).json(new ApiResponse(200, booking, `Booking status updated to '${status}'.`));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/bookings/:id/cancel
// @access  Private/Customer or Admin
// ─────────────────────────────────────────────────────────────────────────────
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found.");

  // Only customer (owner) or admin can cancel
  const isOwner = booking.customerId.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== "admin") throw new ApiError(403, "Not authorized.");

  const cancellableStatuses = ["pending", "accepted", "on_the_way"];
  if (!cancellableStatuses.includes(booking.status)) {
    throw new ApiError(400, `Cannot cancel a booking with status '${booking.status}'. Once arrived or visit completed, please use dispute resolution.`);
  }

  const reason = req.body?.reason ? String(req.body.reason).trim() : "No reason provided.";

  booking.status = "cancelled";
  booking.cancelledBy = req.user.role === "admin" ? "admin" : "customer";
  booking.cancellationReason = reason;
  booking.statusHistory.push({ status: "cancelled", note: reason });

  // If consultation fee was paid and provider did not arrive / booking cancelled, process full refund
  if (booking.pricing?.consultationFeePaid && booking.settlementStatus !== "REFUNDED") {
    await refundToCustomer(booking, "CUSTOMER_CANCELLED_BEFORE_VISIT");
  } else {
    await booking.save();
  }

  // Real-time Socket.IO emission for cancellation
  const io = req.app.get("io");
  if (io) {
    const payload = {
      bookingId: booking._id.toString(),
      status: booking.status,
      updatedAt: booking.updatedAt,
      booking,
      note: booking.cancellationReason,
    };
    io.to(`booking:${booking._id.toString()}`).emit("booking:statusUpdated", payload);
    io.to(`user:${booking.customerId.toString()}`).emit("booking:statusUpdated", payload);
  }

  res.status(200).json(new ApiResponse(200, booking, "Booking cancelled successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/bookings/:id/work-images
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const uploadWorkImages = asyncHandler(async (req, res) => {
  const { type } = req.body; // "before" | "after"
  if (!["before", "after"].includes(type)) throw new ApiError(400, "Type must be 'before' or 'after'.");
  if (!req.files || req.files.length === 0) throw new ApiError(400, "No images provided.");

  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found.");

  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider || booking.providerId.toString() !== provider._id.toString()) {
    throw new ApiError(403, "Not authorized.");
  }

  const uploads = await Promise.all(
    req.files.map((f) => uploadToCloudinary(f.buffer, `work-images/${type}`))
  );

  const images = uploads.map((r) => ({ url: r.secure_url, publicId: r.public_id }));
  const field = type === "before" ? "beforeWorkImages" : "afterWorkImages";

  booking[field].push(...images);
  await booking.save();

  res.status(200).json(new ApiResponse(200, { [field]: booking[field] }, `${type} images uploaded.`));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/bookings  (Admin)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const getAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, from, to } = req.query;
  const query = {};

  if (status) query.status = status;
  if (from || to) {
    query.scheduledDate = {};
    if (from) query.scheduledDate.$gte = new Date(from);
    if (to) query.scheduledDate.$lte = new Date(to);
  }

  const bookings = await Booking.find(query)
    .populate("customerId", "name email phone")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email" } })
    .populate("serviceId", "name category")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Booking.countDocuments(query);

  res.status(200).json(
    new ApiResponse(200, {
      bookings,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/bookings/:id/negotiate
// @access  Private — Customer (propose) or Provider (counter/accept/reject)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/bookings/:id/create-order
// @access  Private/Customer — Create Razorpay Order for Site Visit / Consultation Fee
// ─────────────────────────────────────────────────────────────────────────────
const createConsultationOrder = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("customerId", "name email phone")
    .populate("serviceId", "name category basePrice");

  if (!booking) throw new ApiError(404, "Booking not found.");

  const isCustomer = booking.customerId._id.toString() === req.user._id.toString();
  if (!isCustomer) throw new ApiError(403, "Only the customer can pay for this booking.");

  if (booking.pricing?.consultationFeePaid || booking.paymentStatus === "paid") {
    throw new ApiError(400, "Site Visit / Consultation Fee has already been paid.");
  }

  const feeAmount =
    booking.siteVisitFee ||
    booking.consultationFee ||
    booking.pricing?.consultationFee ||
    booking.totalAmount ||
    booking.estimatedAmount ||
    0;
  if (feeAmount <= 0) {
    throw new ApiError(400, "Invalid consultation fee amount.");
  }

  let order;
  try {
    order = await createOrder(feeAmount, `b_${booking._id}`, {
      bookingId: booking._id.toString(),
      type: "site_visit_fee",
      serviceName: booking.serviceId?.name || "Service",
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    throw new ApiError(
      502,
      `Razorpay payment gateway error: ${err.error?.description || err.message || "Failed to create payment order"}`
    );
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.id,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency || "INR",
        keyId: order.keyId,
        key_id: order.keyId,
        isMock: Boolean(order.isMock),
        consultationFee: feeAmount,
      },
      "Razorpay order generated successfully."
    )
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/bookings/:id/verify-payment
// @access  Private/Customer — Verify Razorpay payment signature for Site Visit Fee
// ─────────────────────────────────────────────────────────────────────────────
const verifyConsultationPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const booking = await Booking.findById(req.params.id)
    .populate("customerId", "name email phone")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email phone" } })
    .populate("serviceId", "name category");

  if (!booking) throw new ApiError(404, "Booking not found.");

  const isCustomer = booking.customerId._id.toString() === req.user._id.toString();
  if (!isCustomer) throw new ApiError(403, "Only the customer can pay for this booking.");

  if (!razorpayOrderId || !razorpayPaymentId) {
    throw new ApiError(400, "Razorpay order ID and payment ID are required.");
  }

  const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    throw new ApiError(400, "Invalid payment signature verification failed.");
  }

  const feeAmount =
    booking.siteVisitFee ||
    booking.consultationFee ||
    booking.pricing?.consultationFee ||
    booking.totalAmount ||
    booking.estimatedAmount ||
    0;

  booking.siteVisitFee = feeAmount;
  booking.consultationFee = feeAmount;
  if (!booking.pricing) booking.pricing = {};
  booking.pricing.consultationFee = feeAmount;
  booking.pricing.consultationFeePaid = true;
  booking.paymentStatus = "paid";

  const payment = await Payment.create({
    bookingId: booking._id,
    customerId: booking.customerId._id,
    providerId: booking.providerId._id,
    amount: feeAmount,
    currency: "INR",
    method: "razorpay",
    status: "success",
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature: razorpaySignature || "mock_signature",
    paidAt: new Date(),
    notes: "Site Visit / Consultation Fee paid via Razorpay",
  });

  booking.paymentId = payment._id;
  booking.statusHistory.push({
    status: booking.status,
    note: `Site visit / consultation fee of ₹${feeAmount} paid successfully via Razorpay (Payment ID: ${razorpayPaymentId}).`,
  });

  await booking.save();

  await notify(
    booking.providerId.userId._id,
    "Consultation Fee Paid",
    `Customer paid ₹${feeAmount} site visit fee for ${booking.serviceId?.name}.`,
    "system",
    booking._id,
    "Booking"
  );

  const io = req.app.get("io");
  if (io) {
    const payload = {
      bookingId: booking._id.toString(),
      status: booking.status,
      updatedAt: booking.updatedAt,
      booking,
      payment,
      note: `Site visit fee of ₹${feeAmount} paid`,
    };
    io.to(`booking:${booking._id.toString()}`).emit("booking:statusUpdated", payload);
    io.to(`user:${booking.providerId.userId._id.toString()}`).emit("booking:statusUpdated", payload);
  }

  res.status(200).json(
    new ApiResponse(200, { booking, payment }, "Payment verified and recorded successfully.")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/bookings/:id/complete-visit
// @access  Private/Provider — Provider marks site visit as completed
// ─────────────────────────────────────────────────────────────────────────────
const completeSiteVisit = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("customerId", "name email phone")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email phone" } })
    .populate("serviceId", "name category");

  if (!booking) throw new ApiError(404, "Booking not found.");

  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider || booking.providerId._id.toString() !== provider._id.toString()) {
    throw new ApiError(403, "Only the assigned provider can mark site visit completed.");
  }

  // Provider must be in 'arrived' status
  if (booking.status !== "arrived") {
    throw new ApiError(
      400,
      `Cannot complete site visit when booking status is '${booking.status}'. Provider must reach and be marked arrived first.`
    );
  }

  booking.status = "site_visit_completed";
  booking.siteVisitCompletedAt = new Date();
  booking.completedBy = req.user._id;

  if (!booking.statusHistory) booking.statusHistory = [];
  booking.statusHistory.push({
    status: "site_visit_completed",
    note: "Provider completed on-site consultation and inspection. Customer & provider to discuss project quotation offline.",
    changedAt: new Date(),
  });

  await booking.save();

  // Notify customer to record their decision
  await notify(
    booking.customerId._id,
    "Site Visit Completed",
    `The provider has completed the site visit for ${booking.serviceId?.name}. Please discuss project terms offline and record whether you want to proceed.`,
    "system",
    booking._id,
    "Booking"
  );

  const io = req.app.get("io");
  if (io) {
    const payload = {
      bookingId: booking._id.toString(),
      status: booking.status,
      updatedAt: booking.updatedAt,
      booking,
      note: "Site visit completed. Awaiting customer decision.",
    };
    io.to(`booking:${booking._id.toString()}`).emit("booking:statusUpdated", payload);
    io.to(`user:${booking.customerId._id.toString()}`).emit("booking:statusUpdated", payload);
  }

  res.status(200).json(new ApiResponse(200, booking, "Site visit marked completed successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/bookings/:id/decision
// @access  Private/Customer — Customer records PROCEED or NOT_PROCEED
// ─────────────────────────────────────────────────────────────────────────────
const recordCustomerDecision = asyncHandler(async (req, res) => {
  const { decision } = req.body; // 'PROCEED' | 'NOT_PROCEED'

  if (!["PROCEED", "NOT_PROCEED"].includes(decision)) {
    throw new ApiError(400, "Decision must be either 'PROCEED' or 'NOT_PROCEED'.");
  }

  const booking = await Booking.findById(req.params.id)
    .populate("customerId", "name email phone")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email phone" } })
    .populate("serviceId", "name category");

  if (!booking) throw new ApiError(404, "Booking not found.");

  const isCustomer = booking.customerId._id.toString() === req.user._id.toString();
  if (!isCustomer) {
    throw new ApiError(403, "Only the customer can record the project decision.");
  }

  if (booking.status !== "site_visit_completed" && booking.status !== "customer_decision") {
    throw new ApiError(
      400,
      `Cannot record decision when booking status is '${booking.status}'. Site visit must be completed first.`
    );
  }

  booking.customerDecision = decision;
  booking.customerDecisionAt = new Date();

  // In BOTH Case A (PROCEED and NOT_PROCEED), site visit was completed, so provider earns consultation fee
  const settlementReason =
    decision === "PROCEED"
      ? "VISIT_COMPLETED_CUSTOMER_PROCEEDED"
      : "VISIT_COMPLETED_CUSTOMER_DECLINED";

  await settleToProvider(booking, settlementReason);

  const decisionNote =
    decision === "PROCEED"
      ? "Customer agreed to proceed with the project offline. Provider earns site visit fee."
      : "Customer decided not to proceed with the project. Provider retains site visit fee for completed visit.";

  await notify(
    booking.providerId.userId._id,
    decision === "PROCEED" ? "Customer Agreed to Proceed" : "Customer Declined Project",
    `${booking.customerId.name} decided: ${decision}. ${decisionNote}`,
    "system",
    booking._id,
    "Booking"
  );

  const io = req.app.get("io");
  if (io) {
    const payload = {
      bookingId: booking._id.toString(),
      status: booking.status,
      settlementStatus: booking.settlementStatus,
      customerDecision: booking.customerDecision,
      updatedAt: booking.updatedAt,
      booking,
      note: decisionNote,
    };
    io.to(`booking:${booking._id.toString()}`).emit("booking:statusUpdated", payload);
    io.to(`user:${booking.providerId.userId._id.toString()}`).emit("booking:statusUpdated", payload);
  }

  res.status(200).json(
    new ApiResponse(200, booking, `Decision recorded: '${decision}'. Settlement completed to provider.`)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/bookings/:id/pay
// @access  Private/Customer — Consultation payment fallback
// ─────────────────────────────────────────────────────────────────────────────
const processPayment = asyncHandler(async (req, res) => {
  const { method = "razorpay" } = req.body;

  const booking = await Booking.findById(req.params.id)
    .populate("customerId", "name email phone")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email phone" } });

  if (!booking) throw new ApiError(404, "Booking not found.");

  const isCustomer = booking.customerId._id.toString() === req.user._id.toString();
  if (!isCustomer) throw new ApiError(403, "Only the customer can make payments for this booking.");

  if (booking.pricing?.consultationFeePaid || booking.paymentStatus === "paid") {
    return res.status(200).json(new ApiResponse(200, { booking }, "Consultation fee already paid."));
  }

  const payAmount =
    booking.siteVisitFee ||
    booking.consultationFee ||
    booking.pricing?.consultationFee ||
    booking.totalAmount ||
    booking.estimatedAmount ||
    0;

  booking.siteVisitFee = payAmount;
  booking.consultationFee = payAmount;
  if (!booking.pricing) booking.pricing = {};
  booking.pricing.consultationFee = payAmount;
  booking.pricing.consultationFeePaid = true;
  booking.paymentStatus = "paid";

  const payment = await Payment.create({
    bookingId: booking._id,
    customerId: booking.customerId._id,
    providerId: booking.providerId._id,
    amount: payAmount,
    currency: "INR",
    method,
    status: "success",
    paidAt: new Date(),
    notes: "Site visit / consultation fee",
  });

  booking.paymentId = payment._id;
  booking.statusHistory.push({
    status: booking.status,
    note: `Site visit / consultation fee of ₹${payAmount} paid.`,
  });

  await booking.save();

  res.status(200).json(new ApiResponse(200, { booking, payment }, "Payment recorded successfully."));
});

// Legacy aliases for backward compatibility if any old clients ping
const negotiateBooking = asyncHandler(async (req, res) => {
  throw new ApiError(400, "Online negotiation is discontinued. Project terms and pricing are discussed offline during site visit.");
});
const submitProjectQuotation = asyncHandler(async (req, res) => {
  throw new ApiError(400, "Project quotation is handled offline directly between customer and provider.");
});
const respondToProjectQuotation = asyncHandler(async (req, res) => {
  throw new ApiError(400, "Quotation response discontinued. Please use the Customer Decision (PROCEED / NOT_PROCEED) endpoint.");
});

module.exports = {
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
  negotiateBooking,
  submitProjectQuotation,
  respondToProjectQuotation,
};
