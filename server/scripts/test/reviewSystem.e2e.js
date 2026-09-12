/**
 * HomeEase — Review & Rating System END-TO-END verification script
 * ================================================================
 *
 * Runs the REAL Express app against the REAL MongoDB connection and exercises
 * the full review flow over HTTP + Mongoose — no mocks. It creates its own
 * throwaway customer, provider, service and bookings (all tagged with a unique
 * run id) and deletes everything it created in a `finally` block, so it is safe
 * to run repeatedly against the dev database.
 *
 * It maps directly onto the 21-step manual test in the task spec (§10) and adds
 * the backend-security and aggregate-math checks the spec calls out. UI-only
 * steps (e.g. "all stars start empty") are verified via their backend-observable
 * equivalent (e.g. an empty/omitted rating is rejected, nothing defaults to 5).
 *
 * HOW TO RUN (from the `server` directory):
 *     node scripts/test/reviewSystem.e2e.js
 *
 * Requires the same .env the server uses (MONGO_URI, JWT_SECRET, ...). It does
 * NOT need the dev server to be running — it boots the app on an ephemeral port.
 *
 * Exit code is 0 only if every check passes; non-zero otherwise (CI friendly).
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const mongoose = require("mongoose");

// Real app + models (same mongoose default connection the controllers use).
const app = require("../../src/app");
const connectDB = require("../../src/config/db");
const User = require("../../src/models/User");
const { Provider } = require("../../src/models/Provider");
const { Booking } = require("../../src/models/Booking");
const Service = require("../../src/models/Service");
const Review = require("../../src/models/Review");
const Notification = require("../../src/models/Notification");

// ── Tiny test harness ────────────────────────────────────────────────────────
let PASS = 0;
let FAIL = 0;
const results = [];

const record = (label, ok, detail = "") => {
  results.push({ label, ok, detail });
  if (ok) {
    PASS += 1;
    console.log(`  \x1b[32m✓ PASS\x1b[0m  ${label}`);
  } else {
    FAIL += 1;
    console.log(`  \x1b[31m✗ FAIL\x1b[0m  ${label}${detail ? `\n           → ${detail}` : ""}`);
  }
};

/** Assert truthy. */
const check = (label, cond, detail = "") => record(label, !!cond, cond ? "" : detail);

/** Assert equality with a helpful diff. */
const checkEq = (label, actual, expected) =>
  record(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// ── HTTP helper against the booted app ───────────────────────────────────────
let BASE = "";
const api = async (endpoint, { method = "GET", token, body } = {}) => {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let parsed = null;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
};

// Track everything we create so cleanup only ever touches our own data.
const created = {
  userIds: [],
  providerIds: [],
  serviceIds: [],
  bookingIds: [],
  reviewIds: [],
};

const TAG = `e2e_${Date.now()}`;
const randomPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999).toString();

const makeCompletedBooking = async ({ customerId, providerId, serviceId, status = "completed" }) => {
  const booking = await Booking.create({
    customerId,
    providerId,
    serviceId,
    status,
    scheduledDate: new Date(),
    address: { street: "1 E2E Test Road", city: "Pune", state: "MH", pincode: "411001" },
  });
  created.bookingIds.push(booking._id);
  return booking;
};

const submitReview = (token, payload) => api("/reviews", { method: "POST", token, body: payload });

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  let server;
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set — check server/.env");

    // Use the app's own connection manager rather than a raw mongoose.connect:
    // it enables `sanitizeFilter` globally and forces IPv4 DNS, so the test runs
    // under exactly the same Mongoose semantics as the running server.
    await connectDB();
    console.log(`\n🔗 Connected to MongoDB (${mongoose.connection.name})`);

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address();
    BASE = `http://127.0.0.1:${port}/api`;
    console.log(`🚀 App listening on ${BASE}`);
    console.log(`🏷  Run tag: ${TAG}\n`);

    // ── Socket recorder ───────────────────────────────────────────────────────
    // server.js does `app.set("io", io)` and the controllers broadcast through
    // `req.app.get("io")`. Installing a recorder here exercises the real room
    // names and payloads without pulling socket.io-client into the server
    // package — and without the flakiness of asserting on async delivery.
    // Without this the broadcast path short-circuits on `if (!io) return`, so a
    // mistyped room name would still show a fully green run.
    const emitted = [];
    app.set("io", {
      to: (room) => ({
        emit: (event, payload) => emitted.push({ room, event, payload }),
      }),
    });
    const emittedFor = (event, room) =>
      emitted.filter((e) => e.event === event && e.room === room);

    // ── Setup: real register (exercises auth + auto Provider creation) ────────
    console.log("── Setup ─────────────────────────────────────────────────────");
    const custReg = await api("/auth/register", {
      method: "POST",
      body: { name: "E2E Customer", email: `${TAG}_cust@example.com`, password: "password123", role: "customer", phone: randomPhone() },
    });
    check("Register customer A → 201", custReg.status === 201, `status ${custReg.status} ${JSON.stringify(custReg.body)}`);
    const customerToken = custReg.body?.accessToken;
    const customerId = custReg.body?.user?._id;
    if (customerId) created.userIds.push(customerId);

    const cust2Reg = await api("/auth/register", {
      method: "POST",
      body: { name: "E2E Customer B", email: `${TAG}_cust2@example.com`, password: "password123", role: "customer", phone: randomPhone() },
    });
    check("Register customer B → 201", cust2Reg.status === 201, `status ${cust2Reg.status}`);
    const customer2Token = cust2Reg.body?.accessToken;
    const customer2Id = cust2Reg.body?.user?._id;
    if (customer2Id) created.userIds.push(customer2Id);

    const provReg = await api("/auth/register", {
      method: "POST",
      body: {
        name: "E2E Provider", email: `${TAG}_prov@example.com`, password: "password123", role: "provider",
        phone: randomPhone(), serviceCategory: "Plumbing", experience: 3, hourlyRate: 500, serviceArea: "Pune", bio: "E2E provider",
      },
    });
    check("Register provider → 201", provReg.status === 201, `status ${provReg.status} ${JSON.stringify(provReg.body)}`);
    const providerUserId = provReg.body?.user?._id;
    if (providerUserId) created.userIds.push(providerUserId);

    // Verify login works too (token round-trip).
    const login = await api("/auth/login", { method: "POST", body: { email: `${TAG}_cust@example.com`, password: "password123" } });
    check("Login customer A → 200 with token", login.status === 200 && !!login.body?.accessToken, `status ${login.status}`);

    const providerDoc = await Provider.findOne({ userId: providerUserId }).select("_id userId rating");
    check("Provider profile auto-created on register", !!providerDoc, "no Provider doc found for provider user");
    const providerId = providerDoc?._id;
    if (providerId) created.providerIds.push(providerId);

    const service = await Service.create({ name: `${TAG} Pipe Fix`, category: "Plumbing", basePrice: 500 });
    created.serviceIds.push(service._id);

    if (!customerToken || !customerId || !providerId) {
      throw new Error("Setup failed — cannot continue without customer token, customer id and provider id.");
    }

    // Four completed bookings for the aggregate-math example (scores 5,4,5,3).
    const b1 = await makeCompletedBooking({ customerId, providerId, serviceId: service._id });
    const b2 = await makeCompletedBooking({ customerId, providerId, serviceId: service._id });
    const b3 = await makeCompletedBooking({ customerId, providerId, serviceId: service._id });
    const b4 = await makeCompletedBooking({ customerId, providerId, serviceId: service._id });
    const bPending = await makeCompletedBooking({ customerId, providerId, serviceId: service._id, status: "pending" });

    console.log("\n── Spec §10: 21-step flow ────────────────────────────────────");

    // Step 1 — "complete a booking"
    checkEq("1. Booking is COMPLETED", b1.status, "completed");

    // Step 2 — "open Write Review": eligible booking has no review yet
    const preReview = await api(`/reviews/booking/${b1._id}`, { token: customerToken });
    check("2. Write-Review eligible (no existing review)", preReview.status === 200 && preReview.body?.data?.review === null,
      `status ${preReview.status}, review ${JSON.stringify(preReview.body?.data?.review)}`);

    // Step 3 — "all stars initially empty": an empty/omitted rating must be REJECTED,
    // proving nothing silently defaults to 5.
    const emptyOverall = await submitReview(customerToken, {
      bookingId: String(b1._id),
      ratings: { workQuality: 5, punctuality: 5, professionalism: 5, valueForMoney: 5 },
      comment: "Missing the overall rating on purpose.",
    });
    checkEq("3a. Submit with NO overall rating → 422 (nothing defaults to 5)", emptyOverall.status, 422);
    const zeroOverall = await submitReview(customerToken, {
      bookingId: String(b1._id), overallRating: 0,
      ratings: { workQuality: 5, punctuality: 5, professionalism: 5, valueForMoney: 5 },
      comment: "Zero overall rating on purpose.",
    });
    checkEq("3b. Submit with overall rating 0 → 422", zeroOverall.status, 422);

    // Steps 4 & 5 — "click 3 → exactly 3, change to 4 → exactly 4": integers 1-5 only,
    // out-of-range rejected, and the exact chosen value is what persists (verified at step 7/9).
    const outOfRange = await submitReview(customerToken, {
      bookingId: String(b1._id), overallRating: 6,
      ratings: { workQuality: 3, punctuality: 3, professionalism: 3, valueForMoney: 3 },
      comment: "Out of range overall rating.",
    });
    checkEq("4. Overall rating 6 → 422 (must be 1–5)", outOfRange.status, 422);
    const fractional = await submitReview(customerToken, {
      bookingId: String(b1._id), overallRating: 3.5,
      ratings: { workQuality: 3, punctuality: 3, professionalism: 3, valueForMoney: 3 },
      comment: "Fractional overall rating.",
    });
    checkEq("5. Fractional overall rating 3.5 → 422 (whole numbers only)", fractional.status, 422);

    // Step 6 — "enter text": comment below the minimum length is rejected.
    const shortComment = await submitReview(customerToken, {
      bookingId: String(b1._id), overallRating: 5,
      ratings: { workQuality: 5, punctuality: 5, professionalism: 5, valueForMoney: 5 },
      comment: "short",
    });
    checkEq("6. Comment under 10 chars → 422", shortComment.status, 422);

    // Step 7 — "submit" the first valid review (overall 5, mixed categories).
    const r1 = await submitReview(customerToken, {
      bookingId: String(b1._id), overallRating: 5,
      ratings: { workQuality: 5, punctuality: 4, professionalism: 5, valueForMoney: 3 },
      comment: "Excellent, punctual and professional work. Highly recommend.",
    });
    check("7. Valid submit → 201", r1.status === 201, `status ${r1.status} ${JSON.stringify(r1.body)}`);
    const created1 = r1.body?.data?.review;
    if (created1?._id) created.reviewIds.push(created1._id);

    // Step 8 — "verify API success": response carries review + recomputed rating.
    check("8a. Response contains the created review", !!created1?._id, JSON.stringify(r1.body?.data));
    check("8b. Response contains a rating aggregate", typeof r1.body?.data?.rating?.average === "number", JSON.stringify(r1.body?.data?.rating));
    checkEq("8c. Stored overall equals the value sent (5, not a default)", created1?.overallRating, 5);
    checkEq("8d. Stored ratings.valueForMoney equals the value sent (3)", created1?.ratings?.valueForMoney, 3);

    // Step 9 — "verify MongoDB contains the review" (query the DB directly).
    const inDb = await Review.findOne({ bookingId: b1._id }).lean();
    check("9a. Review persisted in MongoDB", !!inDb, "no review doc found for booking");
    checkEq("9b. DB overallRating correct", inDb?.overallRating, 5);
    check("9c. DB has all 5 category ratings", !!inDb && inDb.ratings?.workQuality === 5 && inDb.ratings?.punctuality === 4 && inDb.ratings?.professionalism === 5 && inDb.ratings?.valueForMoney === 3, JSON.stringify(inDb?.ratings));
    check("9d. DB has createdAt / updatedAt", !!inDb?.createdAt && !!inDb?.updatedAt, "timestamps missing");
    // Security: identity is server-derived, never from the client body.
    checkEq("9e. customerId derived from JWT (req.user), not body", String(inDb?.customerId), String(customerId));
    checkEq("9f. providerId derived from booking, not body", String(inDb?.providerId), String(providerId));
    // Booking flag flipped.
    const b1After = await Booking.findById(b1._id).select("isReviewed").lean();
    checkEq("9g. Booking.isReviewed flipped to true", b1After?.isReviewed, true);

    // Step 10 — "verify customer sees it" (their own booking + their my-reviews list).
    const custView = await api(`/reviews/booking/${b1._id}`, { token: customerToken });
    check("10a. Customer sees their review on the booking", custView.body?.data?.review?._id && String(custView.body.data.review._id) === String(created1._id),
      JSON.stringify(custView.body?.data?.review));
    const myReviews = await api("/reviews/my", { token: customerToken });
    const inMine = Array.isArray(myReviews.body?.data) && myReviews.body.data.some((r) => String(r._id) === String(created1._id));
    check("10b. Review appears in GET /reviews/my", inMine, `my reviews: ${JSON.stringify(myReviews.body?.data?.map?.((r) => r._id))}`);

    // Step 11 — "verify provider sees it" (public provider reputation endpoint).
    const provView = await api(`/reviews/provider/${providerId}`);
    const provHasIt = (provView.body?.data?.reviews || []).some((r) => String(r._id) === String(created1._id));
    check("11. Provider reputation lists the review", provHasIt, `reviews: ${JSON.stringify(provView.body?.data?.reviews?.map?.((r) => r._id))}`);

    // Spec §7 — real-time update over the EXISTING Socket.IO instance.
    // Room names asserted literally so a typo here or in sockets/index.js fails.
    check("11b. review:created broadcast to the provider room",
      emittedFor("review:created", `provider:${providerId}`).length === 1,
      `rooms seen: ${JSON.stringify(emitted.map((e) => `${e.event}@${e.room}`))}`);
    check("11c. review:created broadcast to the booking room",
      emittedFor("review:created", `booking:${b1._id}`).length === 1,
      `rooms seen: ${JSON.stringify(emitted.map((e) => `${e.event}@${e.room}`))}`);
    check("11d. review:created broadcast to the provider's own user room",
      emittedFor("review:created", `user:${providerUserId}`).length === 1,
      `rooms seen: ${JSON.stringify(emitted.map((e) => `${e.event}@${e.room}`))}`);

    const ratingEvent = emittedFor("provider:ratingUpdated", `provider:${providerId}`)[0];
    check("11e. provider:ratingUpdated was emitted", !!ratingEvent, "no provider:ratingUpdated event recorded");
    // Listeners merge this payload shallowly, so a trimmed aggregate leaves the
    // star distribution and category averages stale in every live view.
    check("11f. Broadcast rating carries the FULL aggregate, not just the average",
      !!ratingEvent?.payload?.rating?.distribution &&
        typeof ratingEvent.payload.rating.workQuality === "number" &&
        typeof ratingEvent.payload.rating.valueForMoney === "number",
      `rating payload: ${JSON.stringify(ratingEvent?.payload?.rating)}`);
    check("11g. Broadcast review carries the public customer name, never contact details",
      !!emittedFor("review:created", `provider:${providerId}`)[0]?.payload?.review?.customerId &&
        !JSON.stringify(emittedFor("review:created", `provider:${providerId}`)[0].payload.review).match(/"(email|phone|address)"/),
      "socket payload leaked a private customer field");

    // Steps 12 & 13 — "open another customer account" + "view same provider".
    check("12. Second customer account is authenticated", !!customer2Token, "no token for customer B");
    const otherCustomerView = await api(`/reviews/provider/${providerId}`, { token: customer2Token });
    check("13. Another customer can load the same provider's reviews", otherCustomerView.status === 200, `status ${otherCustomerView.status}`);

    // Step 14 — "verify same review visible" to the other customer, AND to the public (no token).
    const publicView = await api(`/reviews/provider/${providerId}`);
    const publicHasIt = (publicView.body?.data?.reviews || []).some((r) => String(r._id) === String(created1._id));
    check("14a. Same review visible without any auth (public)", publicHasIt, "review not found in unauthenticated response");
    const otherHasIt = (otherCustomerView.body?.data?.reviews || []).some((r) => String(r._id) === String(created1._id));
    check("14b. Same review visible to the other customer", otherHasIt, "review not found for customer B");
    // Privacy: only public-safe customer fields are exposed.
    const sampleCustomer = (publicView.body?.data?.reviews || []).find((r) => String(r._id) === String(created1._id))?.customerId;
    const leaks = sampleCustomer && (("email" in sampleCustomer) || ("phone" in sampleCustomer) || ("address" in sampleCustomer));
    check("14c. Public review exposes NO private customer data (email/phone/address)", sampleCustomer && !leaks, `customer payload: ${JSON.stringify(sampleCustomer)}`);

    // Step 15 — "verify provider average rating changed" (from real data, persisted).
    checkEq("15a. API rating.average reflects the one review (5.0)", r1.body?.data?.rating?.average, 5);
    const provAfter1 = await Provider.findById(providerId).select("rating").lean();
    checkEq("15b. Provider doc rating.average persisted (5.0)", provAfter1?.rating?.average, 5);
    check("15c. Rating is NOT hardcoded — category averages persisted", provAfter1?.rating?.workQuality === 5 && provAfter1?.rating?.valueForMoney === 3, JSON.stringify(provAfter1?.rating));

    // Step 16 — "verify review count increased".
    checkEq("16a. API rating.totalReviews = 1", r1.body?.data?.rating?.totalReviews, 1);
    checkEq("16b. Provider doc totalReviews = 1", provAfter1?.rating?.totalReviews, 1);

    // Aggregate-math example from the spec (5,4,5,3 → 4.25 → "4.3", 4 reviews).
    console.log("\n── Aggregate math (spec example 5,4,5,3 → 4.3 / 4 reviews) ───");
    const r2 = await submitReview(customerToken, { bookingId: String(b2._id), overallRating: 4, ratings: { workQuality: 4, punctuality: 4, professionalism: 4, valueForMoney: 4 }, comment: "Good, solid work overall. No complaints." });
    const r3 = await submitReview(customerToken, { bookingId: String(b3._id), overallRating: 5, ratings: { workQuality: 5, punctuality: 5, professionalism: 5, valueForMoney: 5 }, comment: "Fantastic once again, would book any time." });
    const r4 = await submitReview(customerToken, { bookingId: String(b4._id), overallRating: 3, ratings: { workQuality: 3, punctuality: 3, professionalism: 3, valueForMoney: 3 }, comment: "Average experience, room to improve a bit." });
    [r2, r3, r4].forEach((r) => { if (r.body?.data?.review?._id) created.reviewIds.push(r.body.data.review._id); });
    check("17a. Exact chosen value stored (sent 4 → stored 4)", r2.body?.data?.review?.overallRating === 4, JSON.stringify(r2.body?.data?.review?.overallRating));
    check("17b. Exact chosen value stored (sent 3 → stored 3)", r4.body?.data?.review?.overallRating === 3, JSON.stringify(r4.body?.data?.review?.overallRating));
    const finalProvView = await api(`/reviews/provider/${providerId}`);
    checkEq("17c. Aggregate average = 4.25 (computed, not hardcoded)", finalProvView.body?.data?.rating?.average, 4.25);
    checkEq("17d. Display rounds to '4.3'", Number(finalProvView.body?.data?.rating?.average).toFixed(1), "4.3");
    checkEq("17e. Total reviews = 4", finalProvView.body?.data?.rating?.totalReviews, 4);
    const provAfter4 = await Provider.findById(providerId).select("rating").lean();
    checkEq("17f. Provider doc average persisted = 4.25", provAfter4?.rating?.average, 4.25);

    // Steps 17/18 in the spec numbering — "try another review for the same booking" → rejected.
    console.log("\n── Duplicate protection & persistence ────────────────────────");
    const dup = await submitReview(customerToken, {
      bookingId: String(b1._id), overallRating: 1,
      ratings: { workQuality: 1, punctuality: 1, professionalism: 1, valueForMoney: 1 },
      comment: "Trying to review the same booking a second time.",
    });
    checkEq("18. Duplicate review for same booking → 409", dup.status, 409);
    const afterDup = await api(`/reviews/provider/${providerId}`);
    checkEq("18b. Duplicate did NOT change the review count (still 4)", afterDup.body?.data?.rating?.totalReviews, 4);
    checkEq("18c. Duplicate did NOT change the average (still 4.25)", afterDup.body?.data?.rating?.average, 4.25);

    // Step 19 — "refresh pages and verify the review still exists" (fresh DB read).
    const persisted = await Review.findById(created1._id).lean();
    check("19. Review still present in MongoDB on re-read (survives refresh)", !!persisted && String(persisted._id) === String(created1._id), "review not found on re-read");

    // ── Extra backend-security checks (spec §9) ───────────────────────────────
    console.log("\n── Backend security (spec §9) ────────────────────────────────");
    // Ownership: customer B cannot review customer A's booking.
    const foreign = await submitReview(customer2Token, {
      bookingId: String(b1._id), overallRating: 5,
      ratings: { workQuality: 5, punctuality: 5, professionalism: 5, valueForMoney: 5 },
      comment: "Trying to review a booking that is not mine.",
    });
    checkEq("S1. Reviewing someone else's booking → 403", foreign.status, 403);
    // Cannot review before completion.
    const notDone = await submitReview(customerToken, {
      bookingId: String(bPending._id), overallRating: 5,
      ratings: { workQuality: 5, punctuality: 5, professionalism: 5, valueForMoney: 5 },
      comment: "Trying to review a booking that is not completed yet.",
    });
    checkEq("S2. Reviewing a non-completed booking → 400", notDone.status, 400);
    // Unauthenticated cannot submit.
    const anon = await submitReview(undefined, {
      bookingId: String(b1._id), overallRating: 5,
      ratings: { workQuality: 5, punctuality: 5, professionalism: 5, valueForMoney: 5 },
      comment: "Anonymous submission attempt should be blocked.",
    });
    check("S3. Unauthenticated submit → 401", anon.status === 401, `status ${anon.status}`);
    // A provider (wrong role) cannot submit a review.
    const providerToken = provReg.body?.accessToken;
    const wrongRole = await submitReview(providerToken, {
      bookingId: String(b1._id), overallRating: 5,
      ratings: { workQuality: 5, punctuality: 5, professionalism: 5, valueForMoney: 5 },
      comment: "Provider role should not be allowed to submit reviews.",
    });
    check("S4. Wrong role (provider) submit → 403", wrongRole.status === 403, `status ${wrongRole.status}`);
    // Body-injected identity is ignored (customerId/providerId spoof stripped).
    const spoofBooking = await makeCompletedBooking({ customerId, providerId, serviceId: service._id });
    const spoof = await submitReview(customerToken, {
      bookingId: String(spoofBooking._id), overallRating: 4,
      customerId: String(customer2Id), providerId: String(providerId),
      ratings: { workQuality: 4, punctuality: 4, professionalism: 4, valueForMoney: 4 },
      comment: "Attempting to spoof customerId in the request body.",
    });
    if (spoof.body?.data?.review?._id) created.reviewIds.push(spoof.body.data.review._id);
    const spoofDb = await Review.findOne({ bookingId: spoofBooking._id }).lean();
    checkEq("S5. Spoofed customerId in body is ignored (uses JWT identity)", String(spoofDb?.customerId), String(customerId));

  } catch (err) {
    console.error("\n💥 Fatal error during test run:", err);
    FAIL += 1;
  } finally {
    // ── Cleanup — only ever our own tagged data ─────────────────────────────
    console.log("\n── Cleanup ───────────────────────────────────────────────────");
    try {
      // config/db enables `sanitizeFilter` globally, which rewrites any filter
      // value containing $-keys into `{ $eq: <that object> }`. These $in lists
      // are built here from ids we created, not from user input, so they must
      // be marked trusted or every deleteMany below would match nothing.
      const ids = (list) => mongoose.trusted({ $in: list });

      if (created.reviewIds.length) await Review.deleteMany({ _id: ids(created.reviewIds) });
      if (created.bookingIds.length) await Booking.deleteMany({ _id: ids(created.bookingIds) });
      if (created.serviceIds.length) await Service.deleteMany({ _id: ids(created.serviceIds) });
      if (created.providerIds.length) await Provider.deleteMany({ _id: ids(created.providerIds) });
      if (created.userIds.length) {
        await Notification.deleteMany({ userId: ids(created.userIds) }).catch(() => {});
        await User.deleteMany({ _id: ids(created.userIds) });
      }
      console.log("🧹 Removed all test data.");
    } catch (cleanupErr) {
      console.error("⚠️  Cleanup problem (you may need to remove tagged docs manually):", cleanupErr.message);
    }

    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();

    // ── Summary ─────────────────────────────────────────────────────────────
    const total = PASS + FAIL;
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log(`  RESULT: ${PASS}/${total} checks passed, ${FAIL} failed`);
    console.log("══════════════════════════════════════════════════════════════");
    if (FAIL > 0) {
      console.log("\nFailed checks:");
      results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.label}${r.detail ? `  (${r.detail})` : ""}`));
    }
    process.exit(FAIL > 0 ? 1 : 0);
  }
})();
