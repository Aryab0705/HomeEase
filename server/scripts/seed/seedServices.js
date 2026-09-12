/**
 * scripts/seed/seedServices.js — Service Catalogue Seeder
 *
 * Inserts one entry per service category into the Services collection.
 * Skips any that already exist by name (idempotent).
 */

const Service = require("../../src/models/Service");
const log     = require("./logger");

// ── Service definitions ────────────────────────────────────────────────────────
// Categories must match the enum in src/models/Service.js exactly.
const SERVICES = [
  {
    name:        "Plumbing Repair",
    category:    "Plumbing",
    description: "Fix leaks, burst pipes, blockages, and complete drainage solutions.",
    basePrice:   299,
    priceType:   "fixed",
    isActive:    true,
  },
  {
    name:        "Electrical Wiring & Fixtures",
    category:    "Electrician",
    description: "Wiring, switchboard installation, fan & light fixture fitting.",
    basePrice:   399,
    priceType:   "fixed",
    isActive:    true,
  },
  {
    name:        "Home Deep Cleaning",
    category:    "Cleaning",
    description: "Full-home deep clean including kitchen, bathrooms, and all rooms.",
    basePrice:   799,
    priceType:   "fixed",
    isActive:    true,
  },
  {
    name:        "AC Service & Repair",
    category:    "AC Repair",
    description: "Servicing, gas refilling, and complete AC installation.",
    basePrice:   499,
    priceType:   "fixed",
    isActive:    true,
  },
  {
    name:        "Interior Wall Painting",
    category:    "Painting",
    description: "Premium quality interior and exterior wall painting service.",
    basePrice:   15,
    priceType:   "per_sqft",
    isActive:    true,
  },
  {
    name:        "Custom Carpentry Work",
    category:    "Carpenter",
    description: "Furniture assembly, custom woodwork, and repair services.",
    basePrice:   350,
    priceType:   "hourly",
    isActive:    true,
  },
  {
    name:        "Home Renovation",
    category:    "Renovation",
    description: "Complete or partial home renovation with quality materials.",
    basePrice:   5000,
    priceType:   "fixed",
    isActive:    true,
  },
  {
    name:        "Pest Control Treatment",
    category:    "Pest Control",
    description: "Cockroach, termite, mosquito, and rodent control treatment.",
    basePrice:   599,
    priceType:   "fixed",
    isActive:    true,
  },
  {
    name:        "Appliance Repair",
    category:    "Appliance Repair",
    description: "Washing machine, refrigerator, microwave, and geyser repair.",
    basePrice:   299,
    priceType:   "fixed",
    isActive:    true,
  },
  {
    name:        "Interior Design Consultation",
    category:    "Interior Design",
    description: "Professional space planning and interior design consultation.",
    basePrice:   999,
    priceType:   "fixed",
    isActive:    true,
  },
];

/**
 * seedServices()
 * @param {ClientSession} [session] — optional Mongoose session for transactions
 * @returns {Promise<{created: number, skipped: number}>}
 */
const seedServices = async (session) => {
  log.section("Seeding Services");

  let created = 0;
  let skipped = 0;

  for (const svcData of SERVICES) {
    // Check by name — each service name is unique in our catalogue
    const existing = await Service.findOne({ name: svcData.name }).session(session ?? null);

    if (existing) {
      log.skip(`Service already exists: ${svcData.name}`);
      skipped++;
      continue;
    }

    await Service.create(
      [svcData],
      session ? { session } : {}
    );

    log.success(`Created service  → ${svcData.category.padEnd(18)} ${svcData.name}`);
    created++;
  }

  return { created, skipped };
};

module.exports = seedServices;
