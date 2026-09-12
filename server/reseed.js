// reseed.js — Delete corrupted demo users and re-seed correctly
require('dotenv').config();
const mongoose = require('mongoose');
const dns      = require('dns');
const bcrypt   = require('bcryptjs');
dns.setDefaultResultOrder('ipv4first');

const DEMO_EMAILS   = ['customer@demo.com', 'admin@demo.com', 'superadmin@homeease.com'];
const DEMO_PASSWORD = 'password123';
const SALT_ROUNDS   = 12;

const DEMO_USERS = [
  { name: 'Demo Customer',  email: 'customer@demo.com',       role: 'customer',    phone: '9000000001', isVerified: true },
  { name: 'Demo Admin',     email: 'admin@demo.com',          role: 'admin',       phone: '9000000003', isVerified: true },
  { name: 'Super Admin',    email: 'superadmin@homeease.com', role: 'super_admin', phone: '9000000004', isVerified: true },
];

mongoose.connect(process.env.MONGO_URI, { family: 4, serverSelectionTimeoutMS: 15000 })
.then(async () => {
  const User = require('./src/models/User');

  // Step 1: Delete corrupted demo users
  const del = await User.deleteMany({ email: { $in: DEMO_EMAILS } });
  console.log(`\n✅ Deleted ${del.deletedCount} old/corrupted demo users`);

  // Step 2: Hash password once
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
  const now = new Date();

  // Step 3: Insert via collection.insertMany — bypasses pre-save hook entirely
  const docs = DEMO_USERS.map(u => ({
    ...u,
    password:  hashedPassword,
    isBlocked: false,
    avatar:    { url: '', publicId: '' },
    address:   {},
    createdAt: now,
    updatedAt: now,
  }));

  const result = await User.collection.insertMany(docs);
  console.log(`✅ Inserted ${result.insertedCount} demo users`);

  // Step 4: Verify each password works
  console.log('\n=== VERIFICATION ===');
  for (const u of DEMO_USERS) {
    const dbUser = await User.findOne({ email: u.email }).select('+password');
    const ok = await bcrypt.compare(DEMO_PASSWORD, dbUser.password);
    console.log(`${ok ? '✅' : '❌'} ${u.role.padEnd(11)} ${u.email} — login: ${ok ? 'WORKS' : 'BROKEN'}`);
  }

  console.log('\n=== CREDENTIALS ===');
  console.log('All accounts use password:', DEMO_PASSWORD);
  console.log('customer@demo.com     → /dashboard');
  console.log('admin@demo.com        → /admin/dashboard');
  console.log('superadmin@homeease.com → /admin/dashboard');

  await mongoose.disconnect();
  process.exit(0);
})
.catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
