const mongoose = require("mongoose");

const quoteSchema = new mongoose.Schema(
  {
    // Reference to the booking request (or a quote-request doc)
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    estimatedCost: {
      type: Number,
      required: [true, "Estimated cost is required"],
      min: 0,
    },
    estimatedDuration: {
      value: { type: Number, required: true },
      unit: {
        type: String,
        enum: ["hours", "days"],
        default: "hours",
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["submitted", "accepted", "rejected", "expired"],
      default: "submitted",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    },
    acceptedAt: Date,
  },
  { timestamps: true }
);

quoteSchema.index({ bookingId: 1, providerId: 1 }, { unique: true });
quoteSchema.index({ customerId: 1, status: 1 });

const Quote = mongoose.model("Quote", quoteSchema);
module.exports = Quote;
