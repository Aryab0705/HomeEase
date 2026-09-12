const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const { Provider } = require('../src/models/Provider');
const Service = require('../src/models/Service');
const { Booking } = require('../src/models/Booking');
const Payment = require('../src/models/Payment');
const bookingController = require('../src/controllers/bookingController');
const assert = require('assert');

function runController(fn, req) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
        return this;
      },
    };
    fn(req, res, (err) => {
      if (err) reject(err);
      else resolve({ statusCode, data: null });
    });
  });
}

async function runTests() {
  await connectDB();
  console.log('=== STARTING HOME EASE SITE VISIT & PROJECT QUOTATION TESTS ===\n');

  // Find test customer, provider, service
  let customerUser = await User.findOne({ role: 'customer' });
  let providerUser = await User.findOne({ role: 'provider' });
  let provider = await Provider.findOne({ userId: providerUser._id });
  let service = await Service.findOne();

  assert(customerUser, 'Customer user required for test');
  assert(providerUser, 'Provider user required for test');
  assert(provider, 'Provider record required for test');
  assert(service, 'Service record required for test');

  const initialProviderEarnings = provider.totalEarnings || 0;
  console.log(`Initial Provider Earnings: ₹${initialProviderEarnings}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Booking Creation with Snapshot of Site Visit / Consultation Fee
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 1: Booking creation & consultation fee snapshot ---');
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 1);

  const reqCreate = {
    user: customerUser,
    body: {
      providerId: provider._id.toString(),
      serviceId: service._id.toString(),
      scheduledDate: scheduledDate.toISOString().split('T')[0],
      scheduledTimeSlot: { start: '10:00', end: '12:00' },
      address: {
        street: '123 Test Avenue',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      problemDescription: 'Site visit needed for major project estimate',
    },
    files: [],
  };

  const origBasePrice = service.basePrice;
  service.basePrice = 5000;
  await service.save();

  const pSvc = provider.services?.find(
    (s) => s.name.toLowerCase() === service.name.toLowerCase() || s.category === service.category
  );
  let origProviderSvcPrice = null;
  if (pSvc) {
    origProviderSvcPrice = pSvc.basePrice;
    pSvc.basePrice = 5000;
    await provider.save();
  }

  const createRes = await runController(bookingController.createBooking, reqCreate);
  const booking1Id = createRes.data.data._id;
  let booking1 = await Booking.findById(booking1Id);

  assert.strictEqual(booking1.pricing.consultationFee, 5000, 'Consultation fee snapshot must be 5000');
  assert.strictEqual(booking1.pricing.consultationFeePaid, true, 'Consultation fee must be paid upon booking');
  assert.strictEqual(booking1.pricing.quoteStatus, 'none', 'Initial quote status must be none');
  assert.strictEqual(booking1.paymentStatus, 'paid', 'Initial payment status must be paid for consultation fee');
  console.log('✓ Booking created with ₹5,000 Consultation Fee snapshot paid.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Provider Arrives before submitting quotation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Quotation blocked before Arrival, allowed after Arrival ---');

  let earlyQuoteErr = null;
  try {
    await runController(bookingController.submitProjectQuotation, {
      params: { id: booking1Id.toString() },
      user: providerUser,
      body: { quotedAmount: 500000, notes: 'Full home electrical rewire' },
      app: { get: () => null },
    });
  } catch (e) {
    earlyQuoteErr = e;
  }
  assert(earlyQuoteErr, 'Must not allow submitting quotation before arrival');
  console.log(`✓ Blocked quotation before arrival: "${earlyQuoteErr.message}"`);

  // Progress to ARRIVED
  booking1.status = 'arrived';
  await booking1.save();

  // Provider submits ONE final project quotation of ₹5,00,000
  await runController(bookingController.submitProjectQuotation, {
    params: { id: booking1Id.toString() },
    user: providerUser,
    body: { quotedAmount: 500000, notes: 'Full home electrical rewire' },
    app: { get: () => null },
  });

  booking1 = await Booking.findById(booking1Id);
  assert.strictEqual(booking1.pricing.finalQuotation, 500000, 'Quoted amount must be 500000');
  assert.strictEqual(booking1.pricing.quoteStatus, 'submitted', 'Quote status must be submitted');
  console.log('✓ Provider successfully submitted ONE final project quotation: ₹5,00,000.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Customer Accepts Quotation -> Site Visit Credit Applied!
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Customer accepts quote & consultation fee is CREDITED ---');
  await runController(bookingController.respondToProjectQuotation, {
    params: { id: booking1Id.toString() },
    user: customerUser,
    body: { action: 'accept' },
    app: { get: () => null },
  });

  booking1 = await Booking.findById(booking1Id);
  assert.strictEqual(booking1.pricing.quoteStatus, 'accepted', 'Quote status must be accepted');
  assert.strictEqual(booking1.pricing.creditedFee, 5000, 'Credited fee must be ₹5,000');
  assert.strictEqual(booking1.pricing.remainingAmount, 495000, 'Remaining balance must be ₹4,95,000 (5,00,000 - 5,000)');
  assert.notStrictEqual(booking1.pricing.remainingAmount, 505000, 'Fee must NOT be an additional charge');
  console.log('✓ Quote accepted! Visit Fee: ₹5,000 | Final Project: ₹5,00,000 | Credit: ₹5,000 | Remaining: ₹4,95,000');

  // Customer pays remaining balance
  console.log('\n--- Test 3b: Customer pays remaining balance ---');
  await runController(bookingController.processPayment, {
    params: { id: booking1Id.toString() },
    user: customerUser,
    body: { paymentType: 'remaining_project', method: 'card' },
    app: { get: () => null },
  });

  booking1 = await Booking.findById(booking1Id);
  assert.strictEqual(booking1.pricing.finalPaymentPaid, true, 'Final payment must be marked paid');
  const paymentRecord = await Payment.findOne({ bookingId: booking1Id, amount: 495000 });
  assert(paymentRecord, 'Payment record of ₹4,95,000 must exist');
  console.log('✓ Remaining balance of ₹4,95,000 paid successfully.');

  // Provider marks completed
  await runController(bookingController.updateBookingStatus, {
    params: { id: booking1Id.toString() },
    user: providerUser,
    body: { status: 'completed' },
    app: { get: () => null },
  });

  const updatedProvider1 = await Provider.findById(provider._id);
  assert.strictEqual(
    updatedProvider1.totalEarnings,
    initialProviderEarnings + 500000,
    'Provider earnings must increase by project total (₹5,00,000)'
  );
  console.log(`✓ Project completed. Provider total earnings updated to: ₹${updatedProvider1.totalEarnings}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Customer Rejection Flow (Fee Retained by Provider, No Project Payment)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: Customer rejects quotation -> Fee retained, No project payment ---');
  const booking2 = await Booking.create({
    customerId: customerUser._id,
    providerId: provider._id,
    serviceId: service._id,
    scheduledDate: new Date(),
    address: { street: '456 Hill Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560002' },
    status: 'arrived',
    pricing: {
      consultationFee: 5000,
      consultationFeePaid: true,
      finalQuotation: null,
      creditedFee: 0,
      quoteStatus: 'none',
    },
    paymentStatus: 'paid',
  });

  // Provider submits quote
  await runController(bookingController.submitProjectQuotation, {
    params: { id: booking2._id.toString() },
    user: providerUser,
    body: { quotedAmount: 300000 },
    app: { get: () => null },
  });

  // Customer rejects quote
  await runController(bookingController.respondToProjectQuotation, {
    params: { id: booking2._id.toString() },
    user: customerUser,
    body: { action: 'reject' },
    app: { get: () => null },
  });

  const reloadedBooking2 = await Booking.findById(booking2._id);
  assert.strictEqual(reloadedBooking2.pricing.quoteStatus, 'rejected', 'Quote status must be rejected');
  assert.strictEqual(reloadedBooking2.pricing.remainingAmount, 0, 'Remaining balance must be 0 upon rejection');
  console.log('✓ Quote rejected! Remaining amount set to 0. No project payment required.');

  // Completing consultation retains the ₹5,000 fee
  const earningsBeforeBooking2 = updatedProvider1.totalEarnings;
  await runController(bookingController.updateBookingStatus, {
    params: { id: booking2._id.toString() },
    user: providerUser,
    body: { status: 'completed' },
    app: { get: () => null },
  });

  const updatedProvider2 = await Provider.findById(provider._id);
  assert.strictEqual(
    updatedProvider2.totalEarnings,
    earningsBeforeBooking2 + 5000,
    'Provider earnings must increase by ₹5,000 for retained consultation fee'
  );
  console.log(`✓ Consultation completed. Provider retained ₹5,000 visit fee (Total earnings: ₹${updatedProvider2.totalEarnings}).`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Cancellation / Provider No-Show Refund
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 5: Cancellation / Provider No-Show -> Full Refund of Fee ---');
  const booking3 = await Booking.create({
    customerId: customerUser._id,
    providerId: provider._id,
    serviceId: service._id,
    scheduledDate: new Date(),
    address: { street: '789 Park Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560003' },
    status: 'accepted',
    pricing: {
      consultationFee: 5000,
      consultationFeePaid: true,
      consultationFeeRefunded: false,
    },
    paymentStatus: 'paid',
  });

  // Cancel booking
  await runController(bookingController.cancelBooking, {
    params: { id: booking3._id.toString() },
    user: customerUser,
    body: { reason: 'Provider did not show up' },
    app: { get: () => null },
  });

  const reloadedBooking3 = await Booking.findById(booking3._id);
  assert.strictEqual(reloadedBooking3.status, 'cancelled', 'Status must be cancelled');
  assert.strictEqual(reloadedBooking3.pricing.consultationFeeRefunded, true, 'Consultation fee must be refunded');
  assert.strictEqual(reloadedBooking3.paymentStatus, 'refunded', 'Payment status must be refunded');
  console.log('✓ Full refund of ₹5,000 consultation fee processed to customer.');

  // Clean up
  service.basePrice = origBasePrice;
  await service.save();
  if (pSvc && origProviderSvcPrice !== null) {
    pSvc.basePrice = origProviderSvcPrice;
  }
  provider.totalEarnings = initialProviderEarnings;
  await provider.save();

  for (const bId of [booking1Id, booking2._id, booking3._id]) {
    await Booking.findByIdAndDelete(bId);
    await Payment.deleteMany({ bookingId: bId });
  }

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
