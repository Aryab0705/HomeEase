/**
 * src/config/db.js — Production-Grade MongoDB Connection Manager
 *
 * Features:
 *  ✅ Singleton guard      — only one connection per process
 *  ✅ Startup validation   — checks MONGO_URI before attempting connect
 *  ✅ Retry strategy       — exponential backoff, up to MAX_RETRIES attempts
 *  ✅ DNS fix              — forces IPv4 for Cloudflare WARP / VPN setups
 *  ✅ Reconnect handlers   — logs disconnect / reconnect events
 *  ✅ Diagnostic hints     — actionable messages for every common failure type
 *  ✅ No process.exit()    — throws so server.js controls the shutdown cleanly
 */

const mongoose = require("mongoose");
const dns      = require("dns");

// ── Mongoose Security ──────────────────────────────────────────────────────────
// NoSQL injection is sanitized at the Express request boundary (in src/app.js)
// Global sanitizeFilter is disabled so internal backend query operators ($in, $ne, etc.) work properly.
mongoose.set("sanitizeFilter", false);

// ── DNS fix ────────────────────────────────────────────────────────────────────
// Node's libuv raw-UDP DNS is blocked by Cloudflare WARP and some VPNs.
// Forcing ipv4first tells Node to use the OS-level resolver instead.
dns.setDefaultResultOrder("ipv4first");

// ── Config ─────────────────────────────────────────────────────────────────────
const MAX_RETRIES    = 5;           // maximum connection attempts
const BASE_DELAY_MS  = 1_000;       // initial retry delay (doubles each attempt)
const CONNECT_TIMEOUT_MS = 15_000;  // how long to wait per attempt

// ── Singleton guard ────────────────────────────────────────────────────────────
let isConnected = false;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Sleep for `ms` milliseconds */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mask password in URI so it can be logged safely */
const maskUri = (uri) => uri.replace(/:([^@]+)@/, ":****@");

/** Print a consistent diagnostic hint based on the error message */
const printDiagnostic = (err) => {
  const msg = err.message || "";

  if (msg.match(/IP|whitelist|ECONNREFUSED|not whitelisted|cannot connect/i)) {
    console.error("\n  🔍 Root Cause: Your IP address is NOT whitelisted in MongoDB Atlas.");
    console.error("  ─────────────────────────────────────────────────────────────");
    console.error("  Fix (permanent for development):");
    console.error("    1. Go to  https://cloud.mongodb.com");
    console.error("    2. Select your project → Security → Network Access");
    console.error("    3. Click  [+ Add IP Address]");
    console.error("    4. Choose 'Allow Access from Anywhere'  →  0.0.0.0/0");
    console.error("    5. Click  Confirm  and wait ~30 seconds");
    console.error(`\n  Your current IP : ${global.__currentIp || "run: Invoke-RestMethod api.ipify.org"}\n`);
    return;
  }

  if (msg.match(/bad auth|Authentication failed|SCRAM/i)) {
    console.error("\n  🔍 Root Cause: Wrong username or password in MONGO_URI.");
    console.error("  Fix: Atlas → Database Access → verify your user credentials.\n");
    return;
  }

  if (msg.match(/ETIMEDOUT|timed out/i)) {
    console.error("\n  🔍 Root Cause: Connection timed out — network or IP whitelist issue.");
    console.error("  Fix: Check Atlas → Network Access → add your current IP.\n");
    return;
  }

  if (msg.match(/querySrv|ENOTFOUND|DNS/i)) {
    console.error("\n  🔍 Root Cause: DNS SRV lookup failed.");
    console.error("  Fix: Pause Cloudflare WARP / VPN, then restart the server.");
    console.error("       Or switch MONGO_URI to the direct (non-SRV) connection string.\n");
    return;
  }

  if (msg.match(/MONGO_URI/i)) {
    console.error("\n  🔍 Root Cause: MONGO_URI is missing from your .env file.");
    console.error("  Fix: Add this line to server/.env:");
    console.error("       MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/homeease\n");
    return;
  }

  // Generic fallback
  console.error(`\n  🔍 Unexpected error: ${msg}\n`);
};

// ── Main connect function ──────────────────────────────────────────────────────
const connectDB = async () => {
  // ① Already connected — idempotent
  if (isConnected) {
    console.log("  ℹ️  MongoDB already connected — skipping duplicate connect.");
    return;
  }

  // ② Validate environment variable
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      "MONGO_URI is not defined in your .env file.\n" +
      "  Add: MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/homeease"
    );
  }

  console.log(`  ✅ MONGO_URI loaded   : ${maskUri(uri)}`);
  console.log(`  🔄 Connecting to MongoDB Atlas...`);

  // ③ Retry loop with exponential backoff
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        family:         4,                // Force IPv4 (WARP/VPN fix)
        serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
        connectTimeoutMS:         CONNECT_TIMEOUT_MS,
      });

      isConnected = true;

      // ── Reconnect/disconnect handlers ──────────────────────────────────
      mongoose.connection.on("disconnected", () => {
        console.warn("\n  ⚠️  MongoDB disconnected — will auto-reconnect...");
        isConnected = false;
      });
      mongoose.connection.on("reconnected", () => {
        console.log("  ✅ MongoDB reconnected.");
        isConnected = true;
      });
      mongoose.connection.on("error", (err) => {
        console.error("  ❌ MongoDB runtime error:", err.message);
      });

      // ── Success log ────────────────────────────────────────────────────
      console.log(`  ✅ MongoDB Connected`);
      console.log(`     Host     : ${conn.connection.host}`);
      console.log(`     Database : ${conn.connection.name}`);
      if (attempt > 1) {
        console.log(`     (Connected on attempt ${attempt}/${MAX_RETRIES})`);
      }

      return; // success — exit retry loop

    } catch (err) {
      lastError = err;

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s ...
        console.warn(`  ⚠️  Attempt ${attempt}/${MAX_RETRIES} failed — retrying in ${delay / 1000}s...`);
        console.warn(`     Reason: ${err.message.split("\n")[0]}`);
        await sleep(delay);
      }
    }
  }

  // ④ All retries exhausted — print diagnosis and re-throw
  console.error(`\n  ❌ MongoDB Connection Failed after ${MAX_RETRIES} attempts`);
  console.error(`     ${lastError.message.split("\n")[0]}`);
  printDiagnostic(lastError);

  throw lastError; // server.js handles process.exit()
};

module.exports = connectDB;
