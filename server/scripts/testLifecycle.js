require('dotenv').config();
const connectDB = require('../src/config/db');
require('../src/models/User');
const { Provider } = require('../src/models/Provider');
const { Booking } = require('../src/models/Booking');
const { evaluateArrivalGeofence, calculateHaversineDistance } = require('../src/utils/geoUtils');
const bookingController = require('../src/controllers/bookingController');
const assert = require('assert');

async function testLifecycle() {
  await connectDB();
  console.log('=== STARTING GPS BOOKING STATUS LIFECYCLE TESTS ===\n');

  // Test Booking 6aa2937caaec4aedc890f53b
  const booking = await Booking.findById('6aa2937caaec4aedc890f53b').populate('providerId');
  assert(booking, 'Test booking not found');
  const provider = booking.providerId;
  assert(provider, 'Provider not found');

  console.log(`Booking ID: ${booking._id}`);
  console.log(`Provider ID: ${provider._id}, User: ${provider.userId}`);

  // Test 1: Future booking cannot transition to ON_THE_WAY before scheduled time
  console.log('\n--- Test 1: Future booking start journey validation ---');
  const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days in future
  booking.scheduledDate = futureDate;
  booking.scheduledTimeSlot = { start: '14:00', end: '16:00' };
  booking.status = 'accepted';
  await booking.save();

  const reqFuture = {
    params: { id: booking._id.toString() },
    body: { status: 'on_the_way' },
    user: { _id: provider.userId, role: 'provider' },
  };
  let errorCaught = null;
  const resMock = {
    status(c) { this.statusCode = c; return this; },
    json(d) { return this; }
  };

  try {
    await new Promise((resolve, reject) => {
      bookingController.updateBookingStatus(reqFuture, resMock, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    errorCaught = err;
  }

  assert(errorCaught, 'Expected error for future start journey attempt');
  console.log(`? Rejected future journey start properly: "${errorCaught.message}"`);

  // Test 2: Only assigned provider can start journey
  console.log('\n--- Test 2: Unauthorized provider cannot start journey ---');
  const reqUnauthorized = {
    params: { id: booking._id.toString() },
    body: { status: 'on_the_way' },
    user: { _id: '6aa38283129984593415dd94', role: 'provider' }, // different provider
  };
  let unauthError = null;
  try {
    await new Promise((resolve, reject) => {
      bookingController.updateBookingStatus(reqUnauthorized, resMock, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    unauthError = err;
  }
  assert(unauthError, 'Expected unauthorized error');
  console.log(`? Rejected unauthorized provider properly: "${unauthError.message}"`);

  // Test 3: Past/Current scheduled time CAN start journey
  console.log('\n--- Test 3: Valid scheduled time starts journey (ON_THE_WAY) ---');
  const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
  booking.scheduledDate = pastDate;
  booking.scheduledTimeSlot = { start: '08:00', end: '10:00' };
  booking.status = 'accepted';
  await booking.save();

  const reqValid = {
    params: { id: booking._id.toString() },
    body: { status: 'on_the_way', note: 'Provider started journey' },
    user: { _id: provider.userId, role: 'provider' },
    app: { get: () => null }
  };
  let validResult = null;
  const resValid = {
    status(c) { this.statusCode = c; return this; },
    json(d) { validResult = d; return this; }
  };

  await new Promise((resolve, reject) => {
    bookingController.updateBookingStatus(reqValid, resValid, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const updatedBooking = await Booking.findById(booking._id);
  assert.strictEqual(updatedBooking.status, 'on_the_way');
  assert.strictEqual(updatedBooking.isLiveTracking, true);
  console.log(`? Booking successfully transitioned to ON_THE_WAY with isLiveTracking=true`);

  // Test 4: Provider is 1-2 km away -> status stays ON_THE_WAY
  console.log('\n--- Test 4: Provider GPS 1.5 km away stays ON_THE_WAY ---');
  // Destination is at lat: 22.2946, lng: 73.3595
  // ~1.5 km away: lat 22.3080, lng 73.3595
  const farLat = 22.3080;
  const farLng = 73.3595;
  const farRes = await evaluateArrivalGeofence(updatedBooking, farLat, farLng, 100);
  console.log(`Distance: ${farRes.distanceMeters}m (${farRes.distanceKm}km)`);
  assert.strictEqual(farRes.statusChanged, false, 'Should NOT trigger arrived at 1.5km');
  assert.strictEqual(updatedBooking.status, 'on_the_way');
  console.log(`? Booking correctly remains ON_THE_WAY when 1.5km away`);

  // Test 5: Provider arrives within 100m (e.g. 50m away) -> automatically becomes ARRIVED
  console.log('\n--- Test 5: Provider within 100m automatically triggers ARRIVED in MongoDB ---');
  // Destination: 22.2946, 73.3595. Near location ~40m away: 22.2946, 73.3591
  const nearLat = 22.2946;
  const nearLng = 73.3591;
  const nearRes = await evaluateArrivalGeofence(updatedBooking, nearLat, nearLng, 100);
  console.log(`Distance: ${nearRes.distanceMeters}m (${nearRes.distanceKm}km)`);
  assert.strictEqual(nearRes.statusChanged, true, 'Should trigger arrived within 100m');
  assert.strictEqual(updatedBooking.status, 'arrived');
  console.log(`? Booking auto-transitioned to ARRIVED!`);

  // Test 6: Hard refresh / MongoDB persistence check
  console.log('\n--- Test 6: Persistence check after refresh from MongoDB ---');
  const refreshedBooking = await Booking.findById(booking._id);
  assert.strictEqual(refreshedBooking.status, 'arrived');
  console.log(`? MongoDB confirmed status: ${refreshedBooking.status}`);

  // Test 7: GET /api/bookings/:id performs geofence check and persists
  console.log('\n--- Test 7: GET /api/bookings/:id geofence check on fetch ---');
  // Reset booking to ON_THE_WAY with near coords
  refreshedBooking.status = 'on_the_way';
  refreshedBooking.currentProviderLocation = { lat: 22.2946, lng: 73.3595, updatedAt: new Date() };
  await refreshedBooking.save();

  let fetchedBooking = null;
  const reqGet = {
    params: { id: booking._id.toString() },
    user: { _id: provider.userId, role: 'provider' },
    app: { get: () => null }
  };
  const resGet = {
    status(c) { this.statusCode = c; return this; },
    json(d) { fetchedBooking = d.data; return this; }
  };

  await new Promise((resolve, reject) => {
    bookingController.getBookingById(reqGet, resGet, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  assert(fetchedBooking, 'Failed to fetch booking');
  assert.strictEqual(fetchedBooking.status, 'arrived');
  const postFetchDB = await Booking.findById(booking._id);
  assert.strictEqual(postFetchDB.status, 'arrived');
  console.log(`? On GET/refresh, booking at same coordinates auto-transitioned to ARRIVED and persisted!`);

  console.log('\n========================================');
  console.log('?? ALL GPS LIFECYCLE TESTS PASSED PERFECTLY!');
  console.log('========================================\n');
  process.exit(0);
}

testLifecycle().catch(e => {
  console.error('Test Failed:', e);
  process.exit(1);
});
