/**
 * server.js — HomeEase Application Entry Point
 *
 * Startup order (strict — never deviates):
 *   Step 1 → Load .env + validate required vars
 *   Step 2 → Create HTTP server + attach Socket.io
 *   Step 3 → Connect MongoDB (with retry)
 *   Step 4 → Bind to the configured API port
 *   Step 5 → Print startup banner
 *   Step 6 → Attach graceful shutdown hooks
 *
 * The server NEVER starts listening before MongoDB is confirmed connected.
 */

// ── Step 1: Load .env FIRST (before any other require that touches process.env) ──
require("dotenv").config();

const http       = require("http");
const app        = require("./src/app");
const connectDB  = require("./src/config/db");
const initSocket = require("./src/sockets");

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE_PORT   = parseInt(process.env.PORT, 10) || 5000;

// ── Environment Validation ─────────────────────────────────────────────────────
// Fail fast if critical variables are missing
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];

const validateEnv = () => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("\n❌ Missing required environment variables:");
    missing.forEach((k) => console.error(`   • ${k}`));
    console.error("\n   Add them to server/.env and restart.\n");
    process.exit(1);
  }
  console.log("  ✅ Environment loaded  :", `NODE_ENV=${process.env.NODE_ENV || "development"}`);
};

// ── HTTP Server ────────────────────────────────────────────────────────────────
const server = http.createServer(app);
const io     = initSocket(server);
app.set("io", io); // controllers access via req.app.get("io")

// ── Port Binding ───────────────────────────────────────────────────────────────
/** Bind to the configured API port with automatic stale port clearing. */
const listenOnPort = (port) =>
  new Promise((resolve, reject) => {
    server.removeAllListeners("listening");
    server.removeAllListeners("error");

    const onError = async (err) => {
      if (err.code === "EADDRINUSE" && process.env.NODE_ENV !== "production") {
        console.warn(`  ⚠️ Port ${port} in use. Clearing stale process...`);
        try {
          const { execSync } = require("child_process");
          if (process.platform === "win32") {
            execSync(`Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue`, { shell: "powershell" });
          } else {
            execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
          }
          await new Promise((r) => setTimeout(r, 1000));
          server.removeAllListeners("error");
          server.listen(port);
          return;
        } catch {
          // Ignore clear error and fallback to standard reject
        }
      }
      reject(err);
    };

    server.once("listening", () => resolve(port));
    server.once("error", onError);
    server.listen(port);
  });

// ── Startup Banner ─────────────────────────────────────────────────────────────
const printBanner = (port) => {
  const env = process.env.NODE_ENV || "development";
  console.log("");
  console.log("  ╔══════════════════════════════════════════════╗");
  console.log("  ║       🏠  HomeEase API Server Started         ║");
  console.log("  ╠══════════════════════════════════════════════╣");
  console.log(`  ║  🌐 API    : http://localhost:${port}/api        ║`);
  console.log(`  ║  🔌 Socket : ws://localhost:${port}              ║`);
  console.log(`  ║  📋 Env    : ${env.padEnd(32)} ║`);
  console.log("  ╚══════════════════════════════════════════════╝");
  console.log("");
};

// ── Main Bootstrap ─────────────────────────────────────────────────────────────
const startServer = async () => {
  // Fetch current IP for diagnostic messages (best-effort, non-blocking)
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const { ip } = await res.json();
    global.__currentIp = ip;
  } catch {
    global.__currentIp = "unknown";
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🏠 HomeEase — Starting up...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // Step 1 — Validate .env
    validateEnv();

    // Step 2 — Log current IP (useful for Atlas whitelist debugging)
    if (global.__currentIp && global.__currentIp !== "unknown") {
      console.log(`  🌐 Your public IP     : ${global.__currentIp}`);
    }

    // Step 3 — Connect to MongoDB BEFORE starting the HTTP server
    await connectDB();

    // Step 4 — Start listening on the configured API port only
    const port = await listenOnPort(BASE_PORT);
    app.set("port", port);

    console.log(`  🚀 Server running     : http://localhost:${port}`);

    printBanner(port);

  } catch (err) {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("  ❌ STARTUP FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(`  Name    : ${err?.name || "Error"}`);
    console.error(`  Message : ${err?.message || err}`);
    console.error(`  Stack   :\n${err?.stack || "No stack trace"}`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(1);
  }
};

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n  ⚠️  ${signal} — shutting down gracefully...`);
  server.close(() => {
    console.log("  ✅ HTTP server closed.");
    process.exit(0);
  });
  // Force-exit after 10 s if graceful close hangs
  setTimeout(() => {
    console.error("  ❌ Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));  // Ctrl+C

process.on("unhandledRejection", (reason) => {
  console.error("  ❌ Unhandled Promise Rejection:", reason?.message || reason);
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (err) => {
  console.error("  ❌ Uncaught Exception:", err.message);
  shutdown("uncaughtException");
});

// ── Boot ───────────────────────────────────────────────────────────────────────
startServer();
