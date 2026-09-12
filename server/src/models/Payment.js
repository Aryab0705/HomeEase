const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: { type: String, default: "INR" },
    method: {
      type: String,
      enum: ["razorpay", "cash", "upi", "card", "netbanking"],
      default: "cash",
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded", "settled_to_provider"],
      default: "pending",
    },
    // Razorpay fields (Phase 2)
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    transactionId: { type: String },
    invoiceUrl: { type: String },
    paidAt: Date,
    settledAt: Date,
    refundedAt: Date,
    refundAmount: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ customerId: 1, status: 1 });
paymentSchema.index({ providerId: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
