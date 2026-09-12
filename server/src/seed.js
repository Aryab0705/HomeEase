/**
 * HomeEase – Database Seeder
 * Creates demo accounts for Customer, Provider, and Admin roles.
 * Also seeds sample services.
 *
 * Usage:
 *   node src/seed.js           → seed (insert only if not exists)
 *   node src/seed.js --destroy → wipe all collections then seed fresh
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

// ── Models ────────────────────────────────────────────────────────────────────
const User     = require("./models/User");
const { Provider } = require("./models/Provider");
const Service  = require("./models/Service");

// ── DB Connect ────────────────────────────────────────────────────────────────
const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected for seeding");
};

// ── Seed Data ─────────────────────────────────────────────────────────────────
const DEMO_PASSWORD = "password123";

const demoUsers = [
  {
    name: "Demo Customer",
    email: "customer@demo.com",
    password: DEMO_PASSWORD,
    role: "customer",
    phone: "9000000001",
    isVerified: true,
  },
  {
    name: "Demo Admin",
    email: "admin@demo.com",
    password: DEMO_PASSWORD,
    role: "admin",
    phone: "9000000003",
    isVerified: true,
  },
  {
    name: "Super Admin",
    email: "superadmin@homeease.com",
    password: DEMO_PASSWORD,
    role: "super_admin",
    phone: "9000000004",
    isVerified: true,
  },
];

const sampleServices = [
  { name: "Plumbing Repair",        category: "Plumbing",         description: "Fix leaks, pipes, and drainage issues.",        basePrice: 299,  priceType: "fixed",   isActive: true },
  { name: "Electrical Wiring",      category: "Electrician",      description: "Wiring, switchboard & fixture installation.",   basePrice: 399,  priceType: "fixed",   isActive: true },
  { name: "Home Deep Cleaning",     category: "Cleaning",         description: "Full-home deep clean by professionals.",        basePrice: 799,  priceType: "fixed",   isActive: true },
  { name: "AC Service & Repair",    category: "AC Repair",        description: "Servicing, gas refill, and AC installation.",   basePrice: 499,  priceType: "fixed",   isActive: true },
  { name: "Interior Painting",      category: "Painting",         description: "Wall painting with premium quality paints.",    basePrice: 15,   priceType: "per_sqft",isActive: true },
  { name: "Carpentry Work",         category: "Carpenter",        description: "Furniture assembly, repair & custom woodwork.", basePrice: 350,  priceType: "hourly",  isActive: true },
  { name: "Home Renovation",        category: "Renovation",       description: "Complete or partial home renovation.",          basePrice: 5000, priceType: "fixed",   isActive: true },
  { name: "Pest Control",           category: "Pest Control",     description: "Cockroach, termite & mosquito treatment.",      basePrice: 599,  priceType: "fixed",   isActive: true },
  { name: "Appliance Repair",       category: "Appliance Repair", description: "Washing machine, fridge, microwave repair.",   basePrice: 299,  priceType: "fixed",   isActive: true },
  { name: "Interior Design",        category: "Interior Design",  description: "Professional interior design consultation.",    basePrice: 999,  priceType: "fixed",   isActive: true },
];

// ── Seeder ────────────────────────────────────────────────────────────────────
const seed = async () => {
  const destroy = process.argv.includes("--destroy");

  if (destroy) {
    console.log("⚠️  --destroy flag detected — wiping collections...");
    await User.deleteMany({});
    await Provider.deleteMany({});
    await Service.deleteMany({});
    console.log("🗑️  Collections cleared.\n");
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  for (const userData of demoUsers) {
    const exists = await User.findOne({ email: userData.email });
    if (exists) {
      console.log(`⏩ Skipping existing user: ${userData.email}`);
      continue;
    }

    // User model pre-save hook handles password hashing automatically
    const user   = await User.create(userData);
    console.log(`✅ Created user: ${user.name} (${user.role}) — ${user.email}`);

    // Auto-create provider profile
    if (user.role === "provider") {
      const alreadyProvider = await Provider.findOne({ userId: user._id });
      if (!alreadyProvider) {
        // Determine provider category based on email
        let primaryCategory, serviceName, serviceDesc, subCategories, skills;
        if (user.email.includes("electrician")) {
          primaryCategory = "Electrician";
          serviceName = "Electrical Wiring";
          serviceDesc = "Wiring, switchboard & fixture installation";
          subCategories = ["Plumbing"];
          skills = ["Wiring", "Switchboard repair", "Circuit breaker", "Electrical safety"];
        } else if (user.email.includes("cleaner")) {
          primaryCategory = "Cleaning";
          serviceName = "Home Deep Cleaning";
          serviceDesc = "Full-home deep clean by professionals";
          subCategories = [];
          skills = ["Deep cleaning", "Sanitization", "Carpet cleaning", "Window cleaning"];
        } else {
          primaryCategory = "Plumbing";
          serviceName = "Plumbing Repair";
          serviceDesc = "Fix leaks, pipes, and drainage issues";
          subCategories = ["Electrician"];
          skills = ["Leak repair", "Pipe installation", "Wiring", "Switchboard repair"];
        }

        await Provider.create({
          userId: user._id,
          bio: `Experienced home service provider with 5+ years expertise in ${primaryCategory.toLowerCase()} and general home repairs.`,
          experience: 5,
          services: [
            {
              category: primaryCategory,
              name: serviceName,
              description: serviceDesc,
              basePrice: primaryCategory === "Cleaning" ? 799 : (primaryCategory === "Electrician" ? 399 : 299),
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
          primaryCategory,
          subCategories,
          skills,
          languages: ["English", "Hindi"],
          hourlyRate: primaryCategory === "Cleaning" ? 450 : (primaryCategory === "Electrician" ? 400 : 350),
          startingPrice: primaryCategory === "Cleaning" ? 799 : (primaryCategory === "Electrician" ? 399 : 299)
        });
        console.log(`   └─ Provider profile created for ${user.name} (${primaryCategory})`);
      }
    }
  }

  // ── Services ───────────────────────────────────────────────────────────────
  for (const svc of sampleServices) {
    const exists = await Service.findOne({ name: svc.name });
    if (exists) {
      console.log(`⏩ Skipping existing service: ${svc.name}`);
      continue;
    }
    await Service.create(svc);
    console.log(`✅ Created service: ${svc.name}`);
  }

  console.log("\n🎉 Seeding complete!");
  console.log("━".repeat(50));
  console.log("📋 Demo Credentials:");
  console.log("   Customer    : customer@demo.com / password123");
  console.log("   Admin       : admin@demo.com    / password123");
  console.log("   Super Admin : superadmin@homeease.com / password123");
  console.log("━".repeat(50));
};

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectDB();
    await seed();
  } catch (err) {
    console.error("❌ Seeder error:", err.message);
    if (err.errors) {
      Object.values(err.errors).forEach(e => console.error("   •", e.message));
    }
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 MongoDB disconnected.");
    process.exit(0);
  }
})();
