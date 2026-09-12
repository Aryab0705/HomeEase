const mongoose = require("mongoose");

/**
 * Canonical rating categories exposed by the API and stored in MongoDB.
 *
 * Historical note: earlier documents stored `quality`, `timeliness` and
 * `communication`. Those legacy paths are still accepted on read so existing
 * reviews keep working, and are transparently mapped onto the canonical
 * names below whenever a document is loaded (see the `post("init")` hook).
 */
const RATING_CATEGORIES = Object.freeze([
  "workQuality",
  "punctuality",
  "professionalism",
  "valueForMoney",
]);

/**
 * Legacy stored field -> canonical field.
 *
 * Drives both the document-level backfill (`post("init")`) and the aggregation
 * fallback (`ratingExpr`), so a legacy review resolves to the same number
 * whether it is read as a document or through a pipeline. `communication` is
 * mapped to `valueForMoney` because old reviews had no value-for-money question
 * and it is the closest available signal.
 */
const LEGACY_RATING_ALIASES = Object.freeze({
  quality: "workQuality",
  timeliness: "punctuality",
  communication: "valueForMoney",
});

/** Human labels used in validation messages and notifications. */
const RATING_LABELS = Object.freeze({
  overallRating: "Overall",
  workQuality: "Work quality",
  punctuality: "Punctuality",
  professionalism: "Professionalism",
  valueForMoney: "Value for money",
});

/**
 * Builds a 1-5 whole-number star field.
 * `required: false` is used for legacy-only paths so old documents that never
 * had the field can still be loaded (and re-saved) without tripping validation.
 */
const starField = (label, { required = true } = {}) => ({
  type: Number,
  required: required ? [true, `${label} rating is required.`] : false,
  min: [1, `${label} rating must be between 1 and 5.`],
  max: [5, `${label} rating must be between 1 and 5.`],
  validate: {
    validator: (v) => v === undefined || v === null || Number.isInteger(v),
    message: `${label} rating must be a whole number from 1 to 5.`,
  },
});

const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: [true, "Booking reference is required."],
      // `unique: true` already builds the index — do NOT also set `index: true`
      // here or Mongoose logs a "Duplicate schema index" warning at boot.
      unique: true, // hard DB guarantee: one review per booking
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer reference is required."],
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: [true, "Provider reference is required."],
    },

    // ── Category ratings ─────────────────────────────────────────────────────
    ratings: {
      workQuality: starField(RATING_LABELS.workQuality),
      punctuality: starField(RATING_LABELS.punctuality),
      professionalism: starField(RATING_LABELS.professionalism),
      valueForMoney: starField(RATING_LABELS.valueForMoney),

      // ── Legacy paths (kept so pre-existing reviews still load/aggregate) ──
      quality: starField("Quality", { required: false }),
      timeliness: starField("Timeliness", { required: false }),
      communication: starField("Communication", { required: false }),
    },

    /**
     * Auto-calculated as the average of the four category ratings:
     * (workQuality + punctuality + professionalism + valueForMoney) / 4
     * Rounded to 1 decimal place. Never manually set by the customer.
     * The provider's public aggregate is the mean of these values.
     */
    overallRating: {
      type: Number,
      min: [1, "Overall rating must be between 1 and 5."],
      max: [5, "Overall rating must be between 1 and 5."],
    },

    comment: {
      type: String,
      trim: true,
      required: [true, "Review comment is required."],
      minlength: [10, "Review comment must be at least 10 characters."],
      maxlength: [1000, "Review comment cannot exceed 1000 characters."],
    },

    images: [{ url: String, publicId: String }],
    isVisible: { type: Boolean, default: true },
    providerResponse: {
      comment: { type: String, trim: true },
      respondedAt: Date,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Backward compatibility ───────────────────────────────────────────────────
// Old documents stored `quality` / `timeliness`. Map them onto the canonical
// names in memory when the document is loaded, so every consumer (controllers,
// populate, toJSON) sees a consistent shape without needing a DB migration.
reviewSchema.post("init", function backfillLegacyRatings(doc) {
  if (!doc.ratings) return;

  for (const [legacy, canonical] of Object.entries(LEGACY_RATING_ALIASES)) {
    if (doc.ratings[canonical] == null && doc.ratings[legacy] != null) {
      doc.ratings[canonical] = doc.ratings[legacy];
    }
  }

  // Legacy reviews had no "value for money" question. Fall back to the closest
  // available signal so the document remains valid if it is ever re-saved.
  // The alias loop above has already copied `communication` across, so reaching
  // this point means there is no legacy value left and only the overall score
  // remains as a source.
  if (doc.ratings.valueForMoney == null && doc.overallRating != null) {
    doc.ratings.valueForMoney = Math.min(5, Math.max(1, Math.round(doc.overallRating)));
  }
});

// ALWAYS compute overallRating from the four category ratings — the server is
// the source of truth. Any client-sent overallRating is overwritten here.
// NOTE: Mongoose 7+ synchronous pre hooks must NOT use next().
reviewSchema.pre("validate", function computeOverallRating() {
  if (this.ratings) {
    const values = RATING_CATEGORIES.map((key) => this.ratings[key]).filter(
      (v) => typeof v === "number"
    );
    if (values.length) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      // Round to 1 decimal place (e.g. 4.75 → 4.8), clamped to [1, 5]
      this.overallRating = Math.min(5, Math.max(1, Math.round(mean * 10) / 10));
    }
  }
});

// ── Aggregation helper ───────────────────────────────────────────────────────
/**
 * MongoDB expression that resolves a rating category, preferring the canonical
 * field and falling back to its legacy equivalent. Aggregation pipelines bypass
 * Mongoose middleware, so legacy coalescing has to be expressed here too.
 */
const ratingExpr = (category) => {
  const legacy = Object.keys(LEGACY_RATING_ALIASES).find(
    (k) => LEGACY_RATING_ALIASES[k] === category
  );
  return legacy
    ? { $ifNull: [`$ratings.${category}`, `$ratings.${legacy}`] }
    : `$ratings.${category}`;
};

// ── Indexes ──────────────────────────────────────────────────────────────────
reviewSchema.index({ providerId: 1, isVisible: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });
// bookingId's unique index is created by `unique: true` above.

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
module.exports.Review = Review;
module.exports.RATING_CATEGORIES = RATING_CATEGORIES;
module.exports.RATING_LABELS = RATING_LABELS;
module.exports.LEGACY_RATING_ALIASES = LEGACY_RATING_ALIASES;
module.exports.ratingExpr = ratingExpr;
