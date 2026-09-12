/**
 * scripts/seed/index.js — Master Seed Orchestrator
 *
 * Coordinates all seed modules in the correct order with transactions.
 *
 * Usage:
 *   node scripts/seed/index.js              → seed (skip existing)
 *   node scripts/seed/index.js --destroy    → wipe all, reseed fresh
 *   node scripts/seed/index.js --users      → seed only users
 *   node scripts/seed/index.js --services   → seed only services
 *
 * Environment: loads .env from project root automatically.
 */

require("dotenv").config(); // load .env from cwd (run from /server)

const mongoose   = require("mongoose");
const log        = require("./logger");
const seedUsers    = require("./seedUsers");
const seedServices = require("./seedServices");

// ── Which modules to run (CLI flags) ─────────────────────────────────────────
const args        = process.argv.slice(2);
const shouldDestroy  = args.includes("--destroy");
const onlyUsers      = args.includes("--users");
const onlyServices   = args.includes("--services");
// If no specific flag → run all
const runAll = !onlyUsers && !onlyServices;

// ── DB Connect ─────────────────────────────────────────────────────────────────
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set. Check your .env file.");

  const dns = require("dns");
  dns.setDefaultResultOrder("ipv4first"); // VPN / WARP fix

  await mongoose.connect(uri, { family: 4 });
  log.success("MongoDB connected for seeding");
};

// ── Destroy (optional) ─────────────────────────────────────────────────────────
const destroyCollections = async () => {
  log.warn("--destroy flag detected — wiping collections...");

  const collectionsToWipe = ["users", "providers", "services"];
  const db = mongoose.connection.db;

  for (const name of collectionsToWipe) {
    try {
      await db.collection(name).deleteMany({});
      log.warn(`  Wiped: ${name}`);
    } catch {
      log.warn(`  Collection '${name}' does not exist yet — skipping.`);
    }
  }

  log.warn("Collections cleared.\n");
};

// ── Run ────────────────────────────────────────────────────────────────────────
const run = async () => {
  const startTime = Date.now();

  log.section("🌱 HomeEase Database Seeder");
  log.info(`Mode: ${shouldDestroy ? "DESTROY + RESEED" : "UPSERT (skip existing)"}`);
  log.info(`Node: ${process.version}  |  Mongoose: ${mongoose.version}\n`);

  try {
    await connectDB();

    // Wipe if --destroy
    if (shouldDestroy) await destroyCollections();

    // ── Start a session for transactional seeding ──────────────────────────
    // NOTE: MongoDB transactions require a replica set.
    // Atlas provides replica sets by default.
    // For local standalone mongod, transactions are NOT supported — catch and fallback.
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      log.info("Transaction started.");
    } catch {
      log.warn("Transactions not supported (likely local standalone). Running without transaction.");
      session = null;
    }

    const totals = { created: 0, skipped: 0 };

    try {
      // Run selected seed modules
      if (runAll || onlyUsers) {
        const r = await seedUsers(session);
        totals.created += r.created;
        totals.skipped += r.skipped;
      }

      if (runAll || onlyServices) {
        const r = await seedServices(session);
        totals.created += r.created;
        totals.skipped += r.skipped;
      }

      // Commit transaction if one was started
      if (session) {
        await session.commitTransaction();
        log.info("Transaction committed.");
      }
    } catch (err) {
      if (session) {
        await session.abortTransaction();
        log.error("Transaction aborted due to error.");
      }
      throw err;
    } finally {
      if (session) session.endSession();
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log.summary([
      ["Records created", String(totals.created)],
      ["Records skipped", String(totals.skipped)],
      ["Time elapsed",    `${elapsed}s`],
      [""],
      ["📋 Demo Credentials", ""],
      ["  Customer",  "customer@demo.com  /  password123"],
      ["  Provider",  "provider@demo.com  /  password123"],
      ["  Admin",     "admin@demo.com     /  password123"],
    ]);

  } catch (err) {
    log.error(`Seeder failed: ${err.message}`);
    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    log.info("MongoDB disconnected.");
  }
};

run();
