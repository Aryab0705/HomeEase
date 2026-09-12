/**
 * scripts/seed/seedUsers.js — Demo User Seeder
 *
 * Creates demo accounts (Customer, Provider, Admin, Super Admin).
 * Skips any that already exist (idempotent).
 *
 * ⚠️  IMPORTANT: Uses Model.collection.insertMany() to bypass the Mongoose
 * pre-save hook. This is intentional — we hash passwords ourselves with bcrypt
 * at SALT_ROUNDS=12 and store the final hash directly.
 *
 * Using User.create() or new User().save() would trigger the pre-save hook
 * and double-hash the password, making login impossible.
 */

const bcrypt   = require("bcryptjs");
const User     = require("../../src/models/User");
const { Provider } = require("../../src/models/Provider");
const log      = require("./logger");

// ── Demo credentials ───────────────────────────────────────────────────────────
const DEMO_PASSWORD   = "password123";  // all demo accounts share this password
const SALT_ROUNDS     = 12;

const DEMO_USERS = [
  {
    name:       "Demo Customer",
    email:      "customer@demo.com",
    role:       "customer",
    phone:      "9000000001",
    isVerified: true,
  },
  {
    name:       "Demo Admin",
    email:      "admin@demo.com",
    role:       "admin",
    phone:      "9000000003",
    isVerified: true,
  },
  {
    name:       "Super Admin",
    email:      "superadmin@homeease.com",
    role:       "super_admin",
    phone:      "9000000004",
    isVerified: true,
  },
];

/**
 * seedUsers()
 * @param {ClientSession} [session] — optional Mongoose session for transactions
 * @returns {Promise<{created: number, skipped: number}>}
 */
const seedUsers = async (session) => {
  log.section("Seeding Users");

  let created = 0;
  let skipped = 0;

  // Hash password once — reused for all demo users
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
  const now = new Date();

  for (const userData of DEMO_USERS) {
    // Check for existing user by email (unique field)
    const existing = await User.findOne({ email: userData.email }).session(session ?? null);

    if (existing) {
      log.skip(`User already exists: ${userData.email}`);
      skipped++;
      continue;
    }

    // ── CRITICAL: Use collection.insertOne() to bypass the pre-save hook ──────
    // User.create() triggers the pre-save hook which would hash the already-hashed
    // password again (double-hash), making login permanently broken.
    // collection.insertOne() writes directly to MongoDB, skipping all hooks.
    const result = await User.collection.insertOne({
      ...userData,
      password:   hashedPassword,
      isBlocked:  false,
      avatar:     { url: "", publicId: "" },
      address:    {},
      createdAt:  now,
      updatedAt:  now,
    });

    // Build a minimal user object for logging (insertOne returns insertedId)
    const user = { _id: result.insertedId, role: userData.role, name: userData.name, email: userData.email };

    log.success(`Created ${user.role.padEnd(11)} → ${user.name} (${user.email})`);
    created++;

    // Auto-create Provider profile for provider role
    if (user.role === "provider") {
      const providerExists = await Provider.findOne({ userId: user._id }).session(session ?? null);

      if (!providerExists) {
        await Provider.create(
          [{
            userId:             user._id,
            bio:                "Experienced home service provider with 5+ years expertise in plumbing, electrical work, and general home repairs.",
            experience:         5,
            services:           [
              {
                category: "Plumbing",
                name: "Plumbing Repair",
                description: "Fix leaks, pipes, and drainage issues",
                basePrice: 299,
                priceUnit: "per visit"
              },
              {
                category: "Electrician",
                name: "Electrical Wiring",
                description: "Wiring, switchboard & fixture installation",
                basePrice: 399,
                priceUnit: "per visit"
              }
            ],
            verificationStatus: "pending",
            status: "pending",
            profileCompleted: true,
            isActive: false,
            verification: {
              overallStatus: "pending",
            },
            availability: {
              isAvailable: true
            },
            serviceArea: {
              city: "Mumbai",
              state: "Maharashtra",
              radius: 20
            },
            rating: {
              average: 4.5,
              totalReviews: 12
            },
            completedJobs: 25,
            responseTime: "<1h",
            primaryCategory: "Plumbing",
            subCategories: ["Electrician"],
            skills: ["Leak repair", "Pipe installation", "Wiring", "Switchboard repair"],
            languages: ["English", "Hindi"],
            hourlyRate: 350,
            startingPrice: 299
          }],
          session ? { session } : {}
        );
        log.info(`   └─ Provider profile created for ${user.name}`);
      }
    }
  }

  return { created, skipped };
};

module.exports = seedUsers;
