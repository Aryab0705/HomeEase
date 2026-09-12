/**
 * normalizeReviewPayload — canonicalises an incoming review request body.
 *
 * WHY THIS EXISTS
 * ---------------
 * The submit-review request could arrive in several different shapes and the
 * validators only ever understood one of them, which is what made "Submit
 * Review" fail with a 422 before the body ever reached the controller:
 *
 *   1. Flat JSON        { quality: 4, punctuality: 5, valueForMoney: 3 }
 *   2. Nested JSON      { ratings: { workQuality: 4, ... } }
 *   3. Stringified JSON { ratings: "{\"workQuality\":4}" }   (FormData)
 *   4. Bracket notation { "ratings[workQuality]": "4" }      (multer text fields)
 *
 * This middleware collapses all four into the single canonical shape the
 * schema and validators expect:
 *
 *   { bookingId, overallRating, ratings: { workQuality, punctuality,
 *     professionalism, valueForMoney }, comment }
 *
 * It also strips `customerId` / `providerId` from the body outright — those are
 * derived server-side from req.user and the booking, never trusted from the
 * client.
 */

/** Accepted client-side aliases (lower-cased, punctuation stripped) -> canonical key. */
const RATING_ALIASES = Object.freeze({
  workquality: "workQuality",
  quality: "workQuality",
  work: "workQuality",

  punctuality: "punctuality",
  timeliness: "punctuality",
  ontime: "punctuality",

  professionalism: "professionalism",
  professional: "professionalism",

  valueformoney: "valueForMoney",
  value: "valueForMoney",
  pricing: "valueForMoney",
});

const CANONICAL_KEYS = Object.freeze([
  "workQuality",
  "punctuality",
  "professionalism",
  "valueForMoney",
]);

/** Normalise a key for alias lookup: "value_for_money" -> "valueformoney". */
const slug = (key) => String(key).toLowerCase().replace(/[^a-z]/g, "");

/**
 * Coerce a star value to a number. Returns undefined for blank/garbage input so
 * express-validator reports "required" rather than "must be an integer".
 * Non-integers (e.g. 4.5) are returned as-is so the validator can reject them.
 */
const toStar = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
};

/** Parse `ratings` when it arrives as a JSON string (multipart/form-data). */
const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
};

/**
 * Collect rating values from every supported shape into one flat bag,
 * keyed by canonical name. Later sources do not override earlier ones,
 * so an explicit nested `ratings` object wins over a flat duplicate.
 */
const collectRatings = (body) => {
  const out = {};

  const assign = (rawKey, rawValue) => {
    const canonical = RATING_ALIASES[slug(rawKey)];
    if (!canonical) return;
    if (out[canonical] !== undefined) return; // first writer wins
    const star = toStar(rawValue);
    if (star !== undefined) out[canonical] = star;
  };

  // Shape 2 & 3 — nested object, or JSON string
  const nested =
    typeof body.ratings === "string"
      ? parseMaybeJson(body.ratings)
      : body.ratings;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [k, v] of Object.entries(nested)) assign(k, v);
  }

  // Shape 4 — "ratings[workQuality]" bracket keys left flat by multer
  for (const [k, v] of Object.entries(body)) {
    const match = /^ratings\[(.+)\]$/.exec(k);
    if (match) assign(match[1], v);
  }

  // Shape 1 — flat top-level fields
  for (const [k, v] of Object.entries(body)) {
    if (k === "ratings" || k === "overallRating") continue;
    if (/^ratings\[/.test(k)) continue;
    assign(k, v);
  }

  return out;
};

/**
 * Pure normaliser — exported separately so it can be unit-tested without
 * spinning up Express.
 */
const normalizeReviewBody = (rawInput) => {
  // A default parameter only fires on `undefined`, so guard against an explicit
  // null body too rather than throwing a TypeError on the reads below.
  const rawBody = rawInput || {};
  const body = { ...rawBody };
  const ratings = collectRatings(body);

  // Drop every alias/bracket key so only the canonical shape survives.
  for (const key of Object.keys(body)) {
    if (/^ratings\[/.test(key)) delete body[key];
    else if (key !== "ratings" && key !== "overallRating" && RATING_ALIASES[slug(key)]) {
      delete body[key];
    }
  }

  // Never trust identity fields from the client (see backend-security rules).
  delete body.customerId;
  delete body.providerId;
  delete body.customer;
  delete body.provider;

  const normalized = {
    ...body,
    ratings,
    // overallRating is always computed server-side — discard any client-sent value
  };
  delete normalized.overallRating;
  delete normalized.overall;
  delete normalized.rating;

  if (typeof normalized.bookingId === "string") {
    normalized.bookingId = normalized.bookingId.trim();
  } else if (!normalized.bookingId && rawBody.booking) {
    normalized.bookingId = String(rawBody.booking).trim();
  }

  if (typeof normalized.comment === "string") {
    normalized.comment = normalized.comment.trim();
  }

  return normalized;
};

/** Express middleware wrapper. */
const normalizeReviewPayload = (req, res, next) => {
  req.body = normalizeReviewBody(req.body);
  next();
};

module.exports = {
  normalizeReviewPayload,
  normalizeReviewBody,
  CANONICAL_KEYS,
  RATING_ALIASES,
};
