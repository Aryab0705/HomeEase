const mongoose = require("mongoose");

const BOOKING_STATUS = [
  "pending",
  "accepted",
  "rejected",
  "on_the_way",
  "arrived",
  "site_visit_completed",
  "customer_decision",
  "settled",
  "completed",
  "cancelled",
];

const bookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    status: {
      type: String,
      enum: BOOKING_STATUS,
      default: "pending",
    },
    scheduledDate: {
      type: Date,
      required: [true, "Scheduled date is required"],
    },
    scheduledTimeSlot: {
      start: { type: String },
      end: { type: String },
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    customerLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    isLiveTracking: { type: Boolean, default: false },
    currentProviderLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },
    problemDescription: {
      type: String,
      trim: true,
      maxlength: [2000, "Description too long"],
    },
    problemImages: [{ url: String, publicId: String }],
    beforeWorkImages: [{ url: String, publicId: String }],
    afterWorkImages: [{ url: String, publicId: String }],
    estimatedAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    siteVisitFee: { type: Number },
    consultationFee: { type: Number },
    pricing: {
      consultationFee: { type: Number, default: 0 },
      consultationFeePaid: { type: Boolean, default: false },
      consultationFeeRefunded: { type: Boolean, default: false },
      finalQuotation: { type: Number, default: null },
      creditedFee: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: null },
      quoteStatus: {
        type: String,
        enum: ["none", "submitted", "accepted", "rejected"],
        default: "none",
      },
      quoteNotes: { type: String, trim: true },
      quoteSubmittedAt: { type: Date },
      quoteRespondedAt: { type: Date },
      finalPaymentPaid: { type: Boolean, default: false },
    },
    proposedAmount: { type: Number, min: 0 },
    counterAmount: { type: Number, min: 0 },
    agreedAmount: { type: Number, min: 0 },
    negotiationStatus: {
      type: String,
      enum: ["none", "customer_proposed", "provider_countered", "accepted", "rejected"],
      default: "none",
    },
    negotiationHistory: [
      {
        sender: { type: String, enum: ["customer", "provider"], required: true },
        action: { type: String, enum: ["propose", "counter", "accept", "reject"], required: true },
        amount: { type: Number, min: 0 },
        message: { type: String, trim: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded", "partially_refunded"],
      default: "unpaid",
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    cancellationReason: { type: String, trim: true },
    cancelledBy: {
      type: String,
      enum: ["customer", "provider", "admin"],
    },
    // Offline Project Discussion & Settlement Audit Trail
    customerDecision: {
      type: String,
      enum: ["PROCEED", "NOT_PROCEED", null],
      default: null,
    },
    customerDecisionAt: { type: Date },
    providerArrivedAt: { type: Date },
    providerArrivalLatitude: { type: Number },
    providerArrivalLongitude: { type: Number },
    arrivalDistanceMeters: { type: Number },
    siteVisitCompletedAt: { type: Date },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    settlementStatus: {
      type: String,
      enum: ["PENDING", "PROVIDER_EARNED", "REFUND_PENDING", "REFUNDED"],
      default: "PENDING",
    },
    settlementReason: { type: String, trim: true },
    settledAt: { type: Date },
    refundId: { type: String },
    providerEarningId: { type: String },

    completedAt: Date,
    statusHistory: [
      {
        status: { type: String, enum: BOOKING_STATUS },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, trim: true },
      },
    ],
    isEmergency: { type: Boolean, default: false },
    isReviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Sync siteVisitFee, consultationFee, and pricing.consultationFee snapshot on save
bookingSchema.pre("save", function () {
  const fee =
    this.siteVisitFee ||
    this.consultationFee ||
    this.pricing?.consultationFee ||
    this.totalAmount ||
    this.estimatedAmount ||
    0;

  if (fee) {
    if (!this.siteVisitFee) {
      this.siteVisitFee = fee;
    }
    if (!this.consultationFee) {
      this.consultationFee = fee;
    }
    if (this.pricing && !this.pricing.consultationFee) {
      this.pricing.consultationFee = fee;
    }
  }
});

// Automatically ensure siteVisitFee and consultationFee are hydrated on document init
bookingSchema.post("init", function () {
  const fee =
    this.siteVisitFee ||
    this.consultationFee ||
    this.pricing?.consultationFee ||
    this.totalAmount ||
    this.estimatedAmount ||
    0;

  if (fee) {
    if (!this.siteVisitFee) {
      this.siteVisitFee = fee;
    }
    if (!this.consultationFee) {
      this.consultationFee = fee;
    }
    if (this.pricing && !this.pricing.consultationFee) {
      this.pricing.consultationFee = fee;
    }
  }
});

bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ providerId: 1, status: 1 });
bookingSchema.index({ scheduledDate: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = { Booking, BOOKING_STATUS };
