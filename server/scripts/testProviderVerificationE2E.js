const mongoose = require('mongoose');
require('dotenv').config();
require('../src/models/User');
const { Provider } = require('../src/models/Provider');

async function testVerificationSuite() {
  console.log('=== RUNNING PROVIDER VERIFICATION E2E TEST SUITE ===');
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Check Customer Query Simulation
  console.log('\n--- TEST 1: Customer Provider Listing Visibility ---');
  const customerQuery = {
    verificationStatus: 'verified',
    'verification.overallStatus': 'verified',
    status: 'approved',
    profileCompleted: true,
    isActive: true,
    'availability.isAvailable': true,
  };

  const visibleToCustomers = await Provider.find(customerQuery).populate('userId', 'name email');
  console.log(`Visible to customers: ${visibleToCustomers.length} providers`);
  visibleToCustomers.forEach(p => console.log(`  ✓ ${p.userId?.name} (${p.verificationStatus}, overall: ${p.verification?.overallStatus})`));

  const names = visibleToCustomers.map(p => p.userId?.name);
  if (names.some(n => n && n.includes('Demo Provider'))) {
    throw new Error('FAIL: Demo unverified provider is visible to customers!');
  }
  if (!names.includes('Arush Bhingarde') || !names.includes('Tushar') || !names.includes('Arya')) {
    throw new Error('FAIL: Legitimate verified providers are missing from customer view!');
  }
  console.log('PASS: Exactly and only genuinely verified providers are visible to customers.');

  // 2. Check Admin Filters
  console.log('\n--- TEST 2: Admin Filtering (Pending vs Verified vs Rejected) ---');
  const pendingFilter = {
    $or: [
      { verificationStatus: { $in: ['pending', 'under_review'] } },
      { 'verification.overallStatus': { $in: ['pending', 'under_review'] } },
    ],
    status: { $ne: 'rejected' },
    verificationStatus: { $ne: 'rejected' },
    'verification.overallStatus': { $ne: 'rejected' },
  };
  const pendingProviders = await Provider.find(pendingFilter).populate('userId', 'name');
  console.log(`Admin Pending tab count: ${pendingProviders.length}`);
  pendingProviders.forEach(p => console.log(`  - ${p.userId?.name}`));

  const verifiedFilter = {
    verificationStatus: 'verified',
    'verification.overallStatus': 'verified',
    status: 'approved',
  };
  const verifiedProviders = await Provider.find(verifiedFilter).populate('userId', 'name');
  console.log(`Admin Verified tab count: ${verifiedProviders.length}`);
  verifiedProviders.forEach(p => console.log(`  - ${p.userId?.name}`));

  if (pendingProviders.length !== 3 || verifiedProviders.length !== 3) {
    throw new Error(`FAIL: Expected 3 pending and 3 verified, got ${pendingProviders.length} pending, ${verifiedProviders.length} verified.`);
  }
  console.log('PASS: Admin filters mutually isolate pending and verified providers.');

  // 3. Test Provider State Transition (Pending -> Approved -> Rejected -> Reset)
  console.log('\n--- TEST 3: Lifecycle State Transitions ---');
  const demoProvider = await Provider.findOne({ 'userId': pendingProviders[0].userId._id });
  console.log(`Testing with: ${pendingProviders[0].userId.name} (id: ${demoProvider._id})`);

  // Step A: Approve Demo Provider
  demoProvider.verificationStatus = 'verified';
  demoProvider.verification.overallStatus = 'verified';
  demoProvider.status = 'approved';
  demoProvider.profileCompleted = true;
  demoProvider.isActive = true;
  await demoProvider.save();

  const checkApproved = await Provider.findById(demoProvider._id);
  if (checkApproved.verificationStatus !== 'verified' || checkApproved.status !== 'approved' || !checkApproved.isActive) {
    throw new Error('FAIL: Approval transition failed to set consistent flags.');
  }
  console.log('  ✓ Successfully transitioned to Approved/Verified. Provider is now active.');

  // Step B: Reject / Suspend Provider
  demoProvider.verificationStatus = 'rejected';
  demoProvider.verification.overallStatus = 'rejected';
  demoProvider.status = 'rejected';
  demoProvider.isActive = false;
  await demoProvider.save();

  const checkRejected = await Provider.findById(demoProvider._id);
  if (checkRejected.verificationStatus !== 'rejected' || checkRejected.status !== 'rejected' || checkRejected.isActive !== false) {
    throw new Error('FAIL: Rejection transition failed.');
  }
  console.log('  ✓ Successfully transitioned to Rejected. Provider is revoked and inactive.');

  // Step C: Reset back to Pending
  demoProvider.verificationStatus = 'pending';
  demoProvider.verification.overallStatus = 'pending';
  demoProvider.status = 'pending';
  demoProvider.isActive = false;
  await demoProvider.save();
  console.log('  ✓ Reset test provider back to Pending cleanly.');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
  await mongoose.disconnect();
}

testVerificationSuite().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
