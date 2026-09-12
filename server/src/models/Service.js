const mongoose = require("mongoose");
const { SERVICE_CATEGORIES } = require("./Provider");

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
      unique: true,
    },
    category: {
      type: String,
      enum: SERVICE_CATEGORIES,
      required: [true, "Category is required"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    icon: { type: String, default: "" },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    basePrice: {
      type: Number,
      required: [true, "Site Visit / Consultation Fee is required"],
      min: [0, "Fee cannot be negative"],
    },
    priceUnit: {
      type: String,
      enum: ["consultation_fee", "per visit", "per hour", "per sq ft", "fixed"],
      default: "consultation_fee",
    },
    isActive: { type: Boolean, default: true },
    tags: [{ type: String, trim: true }],
    popularityScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ name: "text", description: "text", tags: "text" });

const Service = mongoose.model("Service", serviceSchema);
module.exports = Service;
