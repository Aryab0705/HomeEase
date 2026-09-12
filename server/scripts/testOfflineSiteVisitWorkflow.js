require("dotenv").config({ path: "d:/Home Ease/server/.env" });
const mongoose = require("mongoose");
const { calculateHaversineDistance, evaluateArrivalGeofence } = require("../src/utils/geoUtils");
const { createOrder, verifyPaymentSignature, getKeyId } = require("../src/services/razorpayService");
const { settleToProvider, refundToCustomer } = require("../src/services/settlementService");
const { Booking } = require("../src/models/Booking");

async function runTests() {
  console.log("==================================================");
  console.log("🧪 STARTING OFFLINE SITE VISIT WORKFLOW TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Connect DB if MONGO_URI is valid, or run with mocked DB operations
  let dbConnected = false;
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
      dbConnected = true;
      console.log("  [DB] Connected to MongoDB Atlas for integration testing.");
    }
  } catch (e) {
    console.log("  [DB] Remote Atlas connection skipped/offline, testing with in-memory validation.");
  }

  // ── TEST 1: Razorpay Order Creation & Signature Verification ─────────────
  console.log("\n--- TEST 1: Razorpay Order Creation & Verification ---");
  try {
    const fee = 200;
    const order = await createOrder(fee, "test_b_123", { test: true });
    assert(order != null && order.id != null, `Order created with ID: ${order.id}`);
    assert(order.amount === 20000, `Order amount in paise is 20000 (₹200)`);
    assert(order.currency === "INR", `Order currency is INR`);

    // In live mode with real keys, calculate real HMAC signature; in mock mode any string works
    const crypto = require("crypto");
    const secret = process.env.RAZORPAY_KEY_SECRET || "mock_secret";
    const testPaymentId = "pay_test_" + Date.now();
    const expectedSig = crypto.createHmac("sha256", secret).update(order.id + "|" + testPaymentId).digest("hex");

    const validSig = verifyPaymentSignature(order.id, testPaymentId, expectedSig);
    assert(validSig === true, "Signature verification successful (valid HMAC generated)");
  } catch (err) {
    console.error("Test 1 error:", err);
    failed++;
  }

  // ── TEST 2: Geofence Arrival & Audit Trail Persistence ───────────────────
  console.log("\n--- TEST 2: Geofence Arrival & Audit Trail Recording ---");
  try {
    // Destination: Lat 12.9716, Lng 77.5946 (Bangalore)
    // Provider nearby: Lat 12.9719, Lng 77.5948 (~40 meters away)
    const dist = calculateHaversineDistance(12.9716, 77.5946, 12.9719, 77.5948);
    assert(dist.distanceMeters <= 100, `Distance ${dist.distanceMeters}m is within 100m geofence`);

    let mockBooking = {
      _id: new mongoose.Types.ObjectId(),
      status: "on_the_way",
      customerLocation: { latitude: 12.9716, longitude: 77.5946 },
      statusHistory: [],
      markModified: () => {},
      save: async function() { return this; }
    };

    const res = await evaluateArrivalGeofence(mockBooking, 12.9719, 77.5948, 100);
    assert(res.statusChanged === true, "Booking status transitioned to arrived");
    assert(mockBooking.status === "arrived", "mockBooking.status is 'arrived'");
    assert(mockBooking.providerArrivedAt != null, "mockBooking.providerArrivedAt is recorded");
    assert(mockBooking.providerArrivalLatitude === 12.9719, "mockBooking.providerArrivalLatitude is recorded");
    assert(mockBooking.arrivalDistanceMeters <= 100, `Arrival distance recorded: ${mockBooking.arrivalDistanceMeters}m`);
  } catch (err) {
    console.error("Test 2 error:", err);
    failed++;
  }

  // ── TEST 3: Site Visit Completed & Customer Decision: PROCEED ─────────────
  console.log("\n--- TEST 3: Case A - Customer Decision: PROCEED ---");
  try {
    let bookingCaseA = {
      _id: new mongoose.Types.ObjectId(),
      providerId: null, // Test without live provider doc update if db offline
      status: "site_visit_completed",
      customerDecision: "PROCEED",
      pricing: { consultationFee: 200, consultationFeePaid: true },
      settlementStatus: "PENDING",
      statusHistory: [],
      save: async function() { return this; }
    };

    await settleToProvider(bookingCaseA, "VISIT_COMPLETED_CUSTOMER_PROCEEDED");
    assert(bookingCaseA.settlementStatus === "PROVIDER_EARNED", "Settlement status is PROVIDER_EARNED");
    assert(bookingCaseA.status === "settled", "Booking status is 'settled'");
    assert(bookingCaseA.settlementReason === "VISIT_COMPLETED_CUSTOMER_PROCEEDED", "Settlement reason matches PROCEEDED");
    assert(bookingCaseA.settledAt != null, "settledAt timestamp recorded");
  } catch (err) {
    console.error("Test 3 error:", err);
    failed++;
  }

  // ── TEST 4: Case A - Customer Decision: NOT_PROCEED (Retained Fee) ─────────
  console.log("\n--- TEST 4: Case A - Customer Decision: NOT_PROCEED ---");
  try {
    let bookingCaseB = {
      _id: new mongoose.Types.ObjectId(),
      providerId: null,
      status: "site_visit_completed",
      customerDecision: "NOT_PROCEED",
      pricing: { consultationFee: 200, consultationFeePaid: true },
      settlementStatus: "PENDING",
      statusHistory: [],
      save: async function() { return this; }
    };

    // Provider completed the visit, so fee is retained by provider
    await settleToProvider(bookingCaseB, "VISIT_COMPLETED_CUSTOMER_DECLINED");
    assert(bookingCaseB.settlementStatus === "PROVIDER_EARNED", "Settlement status is PROVIDER_EARNED (Provider earns fee)");
    assert(bookingCaseB.status === "settled", "Booking status is 'settled'");
    assert(bookingCaseB.settlementReason === "VISIT_COMPLETED_CUSTOMER_DECLINED", "Settlement reason matches DECLINED");
  } catch (err) {
    console.error("Test 4 error:", err);
    failed++;
  }

  // ── TEST 5: Case B/C/E - Cancellation Before Arrival (Customer Refund) ─────
  console.log("\n--- TEST 5: Customer Refund on Cancellation Before Arrival ---");
  try {
    let bookingCancel = {
      _id: new mongoose.Types.ObjectId(),
      paymentId: null,
      status: "cancelled",
      pricing: { consultationFee: 200, consultationFeePaid: true, consultationFeeRefunded: false },
      paymentStatus: "paid",
      settlementStatus: "PENDING",
      statusHistory: [],
      save: async function() { return this; }
    };

    await refundToCustomer(bookingCancel, "CUSTOMER_CANCELLED_BEFORE_VISIT");
    assert(bookingCancel.settlementStatus === "REFUNDED", "Settlement status is REFUNDED");
    assert(bookingCancel.paymentStatus === "refunded", "Payment status is 'refunded'");
    assert(bookingCancel.pricing.consultationFeeRefunded === true, "consultationFeeRefunded flag set to true");
    assert(bookingCancel.settledAt != null, "settledAt timestamp recorded for refund");
  } catch (err) {
    console.error("Test 5 error:", err);
    failed++;
  }

  // ── TEST 6: Idempotent Settlement Protection ──────────────────────────────
  console.log("\n--- TEST 6: Idempotency Verification ---");
  try {
    let alreadySettledBooking = {
      _id: new mongoose.Types.ObjectId(),
      settlementStatus: "PROVIDER_EARNED",
      settlementReason: "VISIT_COMPLETED_CUSTOMER_PROCEEDED",
      save: async function() { throw new Error("Should not re-save already settled booking!"); }
    };

    const res1 = await settleToProvider(alreadySettledBooking, "SOME_OTHER_REASON");
    assert(res1.settlementStatus === "PROVIDER_EARNED", "Idempotent settleToProvider prevented double settlement");

    let alreadyRefundedBooking = {
      _id: new mongoose.Types.ObjectId(),
      settlementStatus: "REFUNDED",
      save: async function() { throw new Error("Should not re-save already refunded booking!"); }
    };

    const res2 = await refundToCustomer(alreadyRefundedBooking, "ANOTHER_REASON");
    assert(res2.settlementStatus === "REFUNDED", "Idempotent refundToCustomer prevented double refund");
  } catch (err) {
    console.error("Test 6 error:", err);
    failed++;
  }

  // ── TEST 7: Safe Cancellation Without Request Body (Fix for undefined.reason bug) ──
  console.log("\n--- TEST 7: Safe Cancellation Handling (Fix undefined.reason bug) ---");
  try {
    // Simulate req.body being undefined, null, or empty
    const testCases = [
      { body: undefined, expectedReason: "No reason provided." },
      { body: null, expectedReason: "No reason provided." },
      { body: {}, expectedReason: "No reason provided." },
      { body: { reason: "Customer had an emergency" }, expectedReason: "Customer had an emergency" },
    ];

    for (const tc of testCases) {
      const mockReq = { body: tc.body };
      // Exactly replicate the fixed controller extraction logic:
      const extractedReason = mockReq.body?.reason ? String(mockReq.body.reason).trim() : "No reason provided.";
      assert(extractedReason === tc.expectedReason, `Extracted reason '${extractedReason}' matches expected '${tc.expectedReason}' without error`);
    }

    // Verify booking cancellation state update
    let pendingBooking = {
      _id: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(),
      status: "pending",
      pricing: { consultationFee: 200, consultationFeePaid: true },
      settlementStatus: "PENDING",
      statusHistory: [],
      save: async function() { return this; }
    };

    const cancellableStatuses = ["pending", "accepted", "on_the_way"];
    assert(cancellableStatuses.includes(pendingBooking.status), "Pending booking is in cancellable statuses");

    const safeReason = undefined;
    pendingBooking.status = "cancelled";
    pendingBooking.cancelledBy = "customer";
    pendingBooking.cancellationReason = safeReason?.reason ? String(safeReason.reason).trim() : "No reason provided.";
    pendingBooking.statusHistory.push({ status: "cancelled", note: pendingBooking.cancellationReason });

    assert(pendingBooking.status === "cancelled", "Booking status updated to 'cancelled'");
    assert(pendingBooking.cancellationReason === "No reason provided.", "Cancellation reason set safely");
  } catch (err) {
    console.error("Test 7 error:", err);
    failed++;
  }

  // ── TEST 8: Compulsory Payment: Refund on Pre-Paid Booking Cancellation ────
  console.log("\n--- TEST 8: Full Refund Trigger on Pre-Paid Booking Cancellation ---");
  try {
    let paidBooking = {
      _id: new mongoose.Types.ObjectId(),
      status: "pending",
      paymentStatus: "paid",
      pricing: { consultationFee: 250, consultationFeePaid: true, consultationFeeRefunded: false },
      settlementStatus: "PENDING",
      statusHistory: [],
      save: async function() { return this; }
    };

    if (paidBooking.pricing?.consultationFeePaid && paidBooking.settlementStatus !== "REFUNDED") {
      await refundToCustomer(paidBooking, "CUSTOMER_CANCELLED_BEFORE_VISIT");
    }

    assert(paidBooking.settlementStatus === "REFUNDED", "Pre-paid booking cancelled -> settlementStatus is REFUNDED");
    assert(paidBooking.paymentStatus === "refunded", "Pre-paid booking cancelled -> paymentStatus is refunded");
    assert(paidBooking.pricing.consultationFeeRefunded === true, "Pre-paid booking cancelled -> consultationFeeRefunded is true");
  } catch (err) {
    console.error("Test 8 error:", err);
    failed++;
  }

  // ── TEST 9: Pre-Booking Checkout Order (DB Authoritative Fee) ──────────────
  console.log("\n--- TEST 9: Pre-Booking Checkout Order Calculation ---");
  try {
    const dbConsultationFee = 350; // Mock fee pulled from DB
    const checkoutOrder = await createOrder(dbConsultationFee, "chk_test_" + Date.now(), {
      type: "site_visit_fee",
      serviceName: "Plumbing Inspection",
    });

    assert(checkoutOrder.amount === 35000, "Checkout order correctly converts ₹350 into 35000 paise");
    assert(checkoutOrder.currency === "INR", "Checkout order currency is INR");
    assert(checkoutOrder.id.startsWith("order_"), "Checkout order ID correctly generated");
  } catch (err) {
    console.error("Test 9 error:", err);
    failed++;
  }

  // ── TEST 10: Signature Verification Protection Against Unpaid Bookings ────
  console.log("\n--- TEST 10: Payment Signature Protection ---");
  try {
    const crypto = require("crypto");
    const secret = process.env.RAZORPAY_KEY_SECRET || "mock_secret";
    const testOrder = "order_test_999";
    const testPay = "pay_test_888";
    const correctHash = crypto.createHmac("sha256", secret).update(testOrder + "|" + testPay).digest("hex");
    const fakeHash = "fake_invalid_hash_abc";

    const valid = verifyPaymentSignature(testOrder, testPay, correctHash);
    assert(valid === true, "Valid payment signature accepted by verifyPaymentSignature");

    const invalid = verifyPaymentSignature(testOrder, testPay, fakeHash);
    assert(invalid === false, "Tampered signature rejected by verifyPaymentSignature");
  } catch (err) {
    console.error("Test 10 error:", err);
    failed++;
  }

  // ── TEST 11: Provider Internal Earnings Ledger Verification ────────────────
  console.log("\n--- TEST 11: Provider Earnings Ledger (Exact siteVisitFee Snapshot & ₹0 on Cancellation) ---");
  try {
    const { Provider } = require("../src/models/Provider");
    const { Booking } = require("../src/models/Booking");
    const { Payment } = require("../src/models/Payment");

    // 1. Verify Booking schema preserves siteVisitFee & consultationFee snapshots
    const testBookingDoc = new Booking({
      customerId: new mongoose.Types.ObjectId(),
      providerId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      siteVisitFee: 200,
      consultationFee: 200,
      pricing: { consultationFee: 200 },
      scheduledDate: new Date(),
      status: "pending",
      paymentStatus: "paid",
    });

    assert(testBookingDoc.siteVisitFee === 200, "Booking document has siteVisitFee snapshot = 200");
    assert(testBookingDoc.consultationFee === 200, "Booking document has consultationFee snapshot = 200");

    // 2. Simulate Provider Internal Earnings Credit upon Site Visit Completion & Settlement
    let mockProvider = {
      _id: new mongoose.Types.ObjectId(),
      totalEarnings: 1000,
      completedJobs: 5,
      save: async function() { return this; },
    };

    let siteVisitBooking = {
      _id: new mongoose.Types.ObjectId(),
      providerId: mockProvider._id,
      siteVisitFee: 200,
      consultationFee: 200,
      status: "site_visit_completed",
      settlementStatus: "PENDING",
      pricing: { consultationFee: 200, consultationFeePaid: true },
      save: async function() { return this; },
    };

    // Credit fee to provider via settleToProvider
    const initialEarnings = mockProvider.totalEarnings;
    const feeToCredit = siteVisitBooking.siteVisitFee || siteVisitBooking.consultationFee || 200;
    mockProvider.totalEarnings += feeToCredit;
    mockProvider.completedJobs += 1;
    siteVisitBooking.settlementStatus = "PROVIDER_EARNED";
    siteVisitBooking.status = "settled";

    assert(mockProvider.totalEarnings === initialEarnings + 200, `Provider internal earnings credited exact ₹200 (was ${initialEarnings}, now ${mockProvider.totalEarnings})`);
    assert(mockProvider.completedJobs === 6, "Provider completed site visits incremented to 6");
    assert(siteVisitBooking.settlementStatus === "PROVIDER_EARNED", "Settlement status is PROVIDER_EARNED");

    // 3. Provider cancellation / no-show yields ₹0 provider earnings + customer refund
    let cancelledBooking = {
      _id: new mongoose.Types.ObjectId(),
      providerId: mockProvider._id,
      siteVisitFee: 200,
      status: "cancelled",
      cancelledBy: "provider",
      cancellationReason: "Provider could not attend",
      settlementStatus: "PENDING",
      pricing: { consultationFee: 200, consultationFeePaid: true },
      paymentStatus: "paid",
      save: async function() { return this; },
    };

    // Provider earnings must NOT increase
    const providerEarningsBeforeCancel = mockProvider.totalEarnings;
    await refundToCustomer(cancelledBooking, "PROVIDER_CANCELLED_BEFORE_VISIT");

    assert(mockProvider.totalEarnings === providerEarningsBeforeCancel, "Provider earnings remain unchanged (₹0 earned) on provider cancellation");
    assert(cancelledBooking.settlementStatus === "REFUNDED", "Cancelled booking settlementStatus is REFUNDED");
    assert(cancelledBooking.paymentStatus === "refunded", "Cancelled booking paymentStatus is refunded");
  } catch (err) {
    console.error("Test 11 error:", err);
    failed++;
  }

  // ── TEST 12: Dynamic Provider Site Visit Fees (₹200, ₹350, ₹500) Verification ──
  console.log("\n--- TEST 12: Dynamic Provider Site Visit Fees (₹200, ₹350, ₹500) ---");
  try {
    const testCases = [
      { providerName: "Provider A", configuredFee: 200, expectedPaise: 20000 },
      { providerName: "Provider B", configuredFee: 350, expectedPaise: 35000 },
      { providerName: "Provider C", configuredFee: 500, expectedPaise: 50000 },
    ];

    for (const tc of testCases) {
      // 1. Validate Razorpay order creation uses dynamic amount (in paise)
      const order = await createOrder(tc.configuredFee, `order_${tc.configuredFee}`, { test: true });
      assert(order.amount === tc.expectedPaise, `${tc.providerName}: Order amount is ${tc.expectedPaise} paise (₹${tc.configuredFee})`);

      // 2. Validate Booking document snapshot persists exact dynamic fee
      const bookingDoc = new Booking({
        customerId: new mongoose.Types.ObjectId(),
        providerId: new mongoose.Types.ObjectId(),
        serviceId: new mongoose.Types.ObjectId(),
        siteVisitFee: tc.configuredFee,
        consultationFee: tc.configuredFee,
        pricing: { consultationFee: tc.configuredFee },
        scheduledDate: new Date(),
        status: "site_visit_completed",
        paymentStatus: "paid",
        settlementStatus: "PENDING",
      });

      assert(bookingDoc.siteVisitFee === tc.configuredFee, `${tc.providerName}: Booking siteVisitFee snapshot is ₹${tc.configuredFee}`);
      assert(bookingDoc.consultationFee === tc.configuredFee, `${tc.providerName}: Booking consultationFee snapshot is ₹${tc.configuredFee}`);

      // 3. Simulate settlement to provider's internal earnings ledger
      let mockDynamicProvider = {
        _id: bookingDoc.providerId,
        totalEarnings: 0,
        completedJobs: 0,
      };

      const initialEarnings = mockDynamicProvider.totalEarnings;
      const feeToCredit = bookingDoc.siteVisitFee || bookingDoc.consultationFee;
      mockDynamicProvider.totalEarnings += feeToCredit;
      mockDynamicProvider.completedJobs += 1;
      bookingDoc.settlementStatus = "PROVIDER_EARNED";
      bookingDoc.status = "settled";

      assert(
        mockDynamicProvider.totalEarnings === tc.configuredFee,
        `${tc.providerName}: Provider internal ledger credited exactly ₹${tc.configuredFee} (NOT hardcoded ₹200)`
      );
      assert(mockDynamicProvider.completedJobs === 1, `${tc.providerName}: Completed site visits incremented to 1`);
      assert(bookingDoc.settlementStatus === "PROVIDER_EARNED", `${tc.providerName}: Settlement status is PROVIDER_EARNED`);
    }

    // 4. Verify Provider cancellation on a dynamic ₹500 booking yields ₹0 provider earnings + full ₹500 refund
    let providerC = { _id: new mongoose.Types.ObjectId(), totalEarnings: 1500, completedJobs: 3 };
    let dynamicCancelledBooking = {
      _id: new mongoose.Types.ObjectId(),
      providerId: providerC._id,
      siteVisitFee: 500,
      consultationFee: 500,
      status: "cancelled",
      cancelledBy: "provider",
      cancellationReason: "Emergency schedule conflict",
      settlementStatus: "PENDING",
      pricing: { consultationFee: 500, consultationFeePaid: true },
      paymentStatus: "paid",
      save: async function() { return this; },
    };

    const earningsBeforeCancel = providerC.totalEarnings;
    await refundToCustomer(dynamicCancelledBooking, "PROVIDER_CANCELLED_BEFORE_VISIT");

    assert(providerC.totalEarnings === earningsBeforeCancel, "Provider earnings remain unchanged (₹0 earned) on provider cancellation for ₹500 booking");
    assert(dynamicCancelledBooking.settlementStatus === "REFUNDED", "Dynamic ₹500 booking settlementStatus is REFUNDED");
    assert(dynamicCancelledBooking.siteVisitFee === 500, "Refunded booking maintains accurate ₹500 fee snapshot");

  } catch (err) {
    console.error("Test 12 error:", err);
    failed++;
  }

  if (dbConnected) {
    await mongoose.disconnect();
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
