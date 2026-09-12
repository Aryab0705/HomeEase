require("dotenv").config({ path: "d:/Home Ease/server/.env" });
const mongoose = require("mongoose");
const { Provider } = require("../src/models/Provider");
const User = require("../src/models/User");

async function runSettingsTest() {
  console.log("==================================================");
  console.log("🧪 TESTING PROVIDER SETTINGS WORKFLOW & PERSISTENCE");
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

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("  [DB] Connected to MongoDB Atlas.\n");

    // 1. Find a test provider
    const provider = await Provider.findOne({}).populate("userId");
    assert(provider != null, `Found existing provider document: ${provider._id}`);

    // 2. Test initial settings defaults
    const initialRadius = provider.serviceArea?.radius || 20;
    assert(typeof initialRadius === "number", `Initial service radius is numeric: ${initialRadius} km`);

    // 3. Test updating notification preferences and service settings
    const testNotifications = {
      bookingRequests: true,
      messages: false,
      payments: true,
      verification: true,
      announcements: false,
      emailNotifications: true,
      smsNotifications: true,
    };

    const newRadius = 35;
    const newEmergency = true;
    const newAvailability = true;

    // Apply updates directly (mirroring updateMySettings controller logic)
    provider.notificationPreferences = testNotifications;
    provider.emergencyService = newEmergency;
    if (!provider.serviceArea) provider.serviceArea = {};
    provider.serviceArea.radius = newRadius;
    if (!provider.availability) provider.availability = {};
    provider.availability.isAvailable = newAvailability;

    await provider.save();
    console.log("  [Save] Successfully saved updated settings to MongoDB Atlas.");

    // 4. Reload freshly from database to verify persistence
    const reloaded = await Provider.findById(provider._id);
    assert(reloaded != null, "Reloaded provider freshly from MongoDB");
    assert(reloaded.notificationPreferences.messages === false, "notificationPreferences.messages persisted as false");
    assert(reloaded.notificationPreferences.smsNotifications === true, "notificationPreferences.smsNotifications persisted as true");
    assert(reloaded.notificationPreferences.bookingRequests === true, "notificationPreferences.bookingRequests persisted as true");
    assert(reloaded.notificationPreferences.payments === true, "notificationPreferences.payments persisted as true");
    assert(reloaded.emergencyService === true, "emergencyService persisted as true");
    assert(reloaded.serviceArea.radius === 35, "serviceArea.radius persisted as 35 km");
    assert(reloaded.availability.isAvailable === true, "availability.isAvailable persisted as true");

    // 5. Reset to clean defaults
    reloaded.notificationPreferences = {
      bookingRequests: true,
      messages: true,
      payments: true,
      verification: true,
      announcements: true,
      emailNotifications: true,
      smsNotifications: false,
    };
    reloaded.serviceArea.radius = 20;
    await reloaded.save();
    console.log("  [Reset] Restored clean default preferences.");

    await mongoose.disconnect();
  } catch (err) {
    console.error("Test error:", err);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`SETTINGS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  process.exit(failed > 0 ? 1 : 0);
}

runSettingsTest();
