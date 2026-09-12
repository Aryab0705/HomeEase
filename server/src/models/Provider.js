const mongoose = require("mongoose");

const SERVICE_CATEGORIES = [
  "Plumbing",
  "Electrician",
  "Painting",
  "Carpenter",
  "AC Repair",
  "Cleaning",
  "Renovation",
  "Appliance Repair",
  "Pest Control",
  "Interior Design",
];

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const LICENSED_CATEGORIES = ['Electrician'];

const providerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    services: [
      {
        category: {
          type: String,
          enum: SERVICE_CATEGORIES,
          required: true,
        },
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        basePrice: { type: Number, required: true, min: 0 },
        priceUnit: {
          type: String,
          enum: ["consultation_fee", "per visit", "per hour", "per sq ft", "fixed"],
          default: "consultation_fee",
        },
      },
    ],
    primaryCategory: {
      type: String,
      enum: SERVICE_CATEGORIES,
    },
    subCategories: [{
      type: String,
      enum: SERVICE_CATEGORIES,
    }],
    skills: [{
      type: String,
      trim: true,
    }],
    languages: [{
      type: String,
      trim: true,
    }],
    hourlyRate: {
      type: Number,
      min: [0, "Rate cannot be negative"],
    },
    startingPrice: {
      type: Number,
      min: [0, "Starting price cannot be negative"],
    },
    emergencyService: {
      type: Boolean,
      default: false,
    },
    experience: {
      type: Number,
      default: 0,
      min: [0, "Experience cannot be negative"],
    },
    availability: {
      isAvailable: { type: Boolean, default: true },
      emergencyAvailability: { type: Boolean, default: false },
      workingDays: {
        type: [String],
        enum: DAYS_OF_WEEK,
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      },
      workingHours: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "18:00" },
      },
      schedule: [
        {
          day: {
            type: String,
            enum: DAYS_OF_WEEK,
            required: true,
          },
          enabled: { type: Boolean, default: true },
          start: { type: String, default: "09:00" },
          end: { type: String, default: "18:00" },
        },
      ],
      specificDates: [
        {
          date: { type: String, required: true }, // "YYYY-MM-DD"
          isAvailable: { type: Boolean, default: false }, // false = Holiday/Leave, true = Working
          reason: { type: String, default: "" },
          start: { type: String, default: "09:00" },
          end: { type: String, default: "18:00" },
        },
      ],
    },
    serviceArea: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      radius: { type: Number, default: 20 }, // km
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "under_review", "verified", "rejected"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "suspended", "rejected"],
      default: "pending",
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    documents: [
      {
        type: { type: String, trim: true },
        url: String,
        publicId: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    portfolio: [
      {
        title: { type: String, trim: true },
        description: { type: String, trim: true },
        images: [{ url: String, publicId: String }],
        category: { type: String, enum: SERVICE_CATEGORIES },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    rating: {
      // Aggregate of real Review documents — recalculated server-side after
      // every review create / visibility change. Never set from a client.
      average: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },

      // Canonical per-category averages
      workQuality: { type: Number, default: 0 },
      punctuality: { type: Number, default: 0 },
      professionalism: { type: Number, default: 0 },
      valueForMoney: { type: Number, default: 0 },

      // Legacy mirrors, kept in sync so older UI paths keep rendering
      quality: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      timeliness: { type: Number, default: 0 },
    },
    totalEarnings: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    rejectedJobs: { type: Number, default: 0 },
    aadharNumber: {
      type: String,
      trim: true,
      select: false,
    },
    notificationPreferences: {
      bookingRequests: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      verification: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false },
    },

    // ── Verification sub-document ───────────────────────────────────────────
    verification: {
      identity: {
        status: {
          type: String,
          enum: ["not_submitted", "submitted", "verified", "rejected", "mismatch"],
          default: "not_submitted",
        },
        documents: [
          {
            docType: { type: String, trim: true },
            url: String,
            publicId: String,
            uploadedAt: { type: Date, default: Date.now },
          },
        ],
        extractedInfo: {
          name: { type: String, trim: true },
          documentNumber: { type: String, trim: true },
          documentType: { type: String, trim: true },
          rawSummary: { type: String, trim: true },
        },
        ocrResult: {
          status: {
            type: String,
            enum: ["pending", "processing", "processed", "failed", "not_applicable"],
            default: "pending",
          },
          confidence: { type: Number, default: null },
          extractedText: { type: String, trim: true },
          extractedEntities: {
            extractedName: String,
            extractedDocNumber: String,
            extractedDocType: String,
            rawSummary: String,
          },
          matchScore: { type: Number, default: null },
          nameMatched: { type: Boolean, default: false },
          matchStatus: {
            type: String,
            enum: ["match", "mismatch", "not_detected", "failed", "pending"],
            default: "pending",
          },
          warnings: [String],
          processedAt: Date,
        },
        adminNotes: { type: String, trim: true },
        reviewedAt: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
      experience: {
        status: {
          type: String,
          enum: ["not_submitted", "submitted", "verified", "rejected"],
          default: "not_submitted",
        },
        yearsOfExperience: { type: Number, min: 0 },
        description: { type: String, trim: true, maxlength: 1000 },
        previousWorkDetails: { type: String, trim: true, maxlength: 1000 },
        previousEmployerOrClient: { type: String, trim: true },
        evidenceUrls: [
          {
            url: String,
            publicId: String,
            name: { type: String, trim: true },
            docType: { type: String, trim: true, default: "Work Proof" },
            uploadedAt: { type: Date, default: Date.now },
          },
        ],
        ocrResult: {
          status: {
            type: String,
            enum: ["pending", "processed", "failed", "not_applicable"],
            default: "not_applicable",
          },
          confidence: { type: Number, default: 0 },
          extractedText: { type: String, trim: true },
          extractedEntities: {
            extractedName: String,
            extractedOrganization: String,
            extractedDuration: String,
            extractedDates: [String],
            jobKeywords: [String],
            rawTextSummary: String,
          },
          warnings: [String],
          processedAt: Date,
        },
        adminNotes: { type: String, trim: true },
        reviewedAt: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
      skills: {
        status: {
          type: String,
          enum: ["not_submitted", "submitted", "verified", "rejected"],
          default: "not_submitted",
        },
        skillsList: [
          {
            name: { type: String, trim: true },
            yearsOfExperience: { type: Number, min: 0, default: 0 },
          },
        ],
        portfolioDescription: { type: String, trim: true, maxlength: 1000 },
        adminNotes: { type: String, trim: true },
        reviewedAt: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
      qualification: {
        status: {
          type: String,
          enum: ["not_required", "not_submitted", "submitted", "verified", "rejected"],
          default: "not_required",
        },
        isRequired: { type: Boolean, default: false },
        certificates: [
          {
            docType: { type: String, trim: true },
            url: String,
            publicId: String,
            uploadedAt: { type: Date, default: Date.now },
          },
        ],
        adminNotes: { type: String, trim: true },
        reviewedAt: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
      overallStatus: {
        type: String,
        enum: ["pending", "under_review", "verified", "rejected"],
        default: "pending",
      },
      lastReviewedAt: Date,
      lastReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      adminReviewNotes: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

// ── Pre-save: sync verificationStatus from verification.overallStatus ────────
providerSchema.pre("save", function () {
  if (!this.verification) this.verification = {};

  if (this.verification?.overallStatus && this.isModified("verification.overallStatus")) {
    this.verificationStatus = this.verification.overallStatus;
  } else if (this.verificationStatus && this.isModified("verificationStatus")) {
    this.verification.overallStatus = this.verificationStatus;
  }

  // Ensure state consistency
  const effectiveOverall = this.verification?.overallStatus || this.verificationStatus;
  if (effectiveOverall === "rejected") {
    this.verificationStatus = "rejected";
    this.verification.overallStatus = "rejected";
    this.status = "rejected";
    this.isActive = false;
  } else if (effectiveOverall === "verified") {
    this.verificationStatus = "verified";
    this.verification.overallStatus = "verified";
    this.status = "approved";
  } else if (effectiveOverall === "pending" || effectiveOverall === "under_review") {
    this.verificationStatus = effectiveOverall;
    this.verification.overallStatus = effectiveOverall;
    if (this.status === "approved") {
      this.status = "pending";
    }
    this.isActive = false;
  }

  // Auto-set qualification requirement based on primary category
  if (this.primaryCategory && this.isModified("primaryCategory")) {
    const isRequired = LICENSED_CATEGORIES.includes(this.primaryCategory);
    if (!this.verification.qualification) this.verification.qualification = {};
    this.verification.qualification.isRequired = isRequired;
    if (!isRequired && this.verification.qualification.status === "not_submitted") {
      this.verification.qualification.status = "not_required";
    }
  }
});

// Virtual to populate user details
providerSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

providerSchema.set("toJSON", { virtuals: true });
providerSchema.set("toObject", { virtuals: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
providerSchema.index({ "availability.isAvailable": 1, verificationStatus: 1 });
providerSchema.index({ "serviceArea.city": 1, verificationStatus: 1 });
providerSchema.index({ "rating.average": -1 });         // sort by top-rated
providerSchema.index({ "services.category": 1 });       // filter by service category
// userId index is automatically created by unique: true in schema definition

const Provider = mongoose.model("Provider", providerSchema);

module.exports = { Provider, SERVICE_CATEGORIES, DAYS_OF_WEEK, LICENSED_CATEGORIES };
