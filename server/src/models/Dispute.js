const mongoose = require("mongoose");

const disputeSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    raisedAgainst: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: [true, "Dispute reason is required"],
      trim: true,
      maxlength: [2000, "Reason too long"],
    },
    category: {
      type: String,
      enum: [
        "work_quality",
        "payment_issue",
        "no_show",
        "unprofessional_behavior",
        "overcharging",
        "other",
      ],
      default: "other",
    },
    evidenceImages: [{ url: String, publicId: String }],
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "closed"],
      default: "open",
    },
    resolution: {
      type: String,
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: Date,
    adminNotes: {
      type: String,
      trim: true,
      select: false,
    },
  },
  { timestamps: true }
);

disputeSchema.index({ bookingId: 1 });
disputeSchema.index({ status: 1 });

const Dispute = mongoose.model("Dispute", disputeSchema);
module.exports = Dispute;
