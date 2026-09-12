/**
 * src/app.js — Express Application Factory
 *
 * Configures all middleware, security headers, rate limiting, and routes.
 * Does NOT start the HTTP server (that is server.js's job).
 *
 * Middleware order matters:
 *  1. Security (Helmet, CORS)
 *  2. Compression
 *  3. Parsing (JSON, URL-encoded, cookies)
 *  4. Sanitization (must come AFTER parsing)
 *  5. Logging
 *  6. Rate Limiting
 *  7. Routes
 *  8. Error Handlers
 */

const express       = require("express");
const cors          = require("cors");
const helmet        = require("helmet");
const morgan        = require("morgan");
const cookieParser  = require("cookie-parser");
const compression   = require("compression");

// ── Route imports ──────────────────────────────────────────────────────────────
const authRoutes         = require("./routes/authRoutes");
const userRoutes         = require("./routes/userRoutes");
const providerRoutes     = require("./routes/providerRoutes");
const serviceRoutes      = require("./routes/serviceRoutes");
const bookingRoutes      = require("./routes/bookingRoutes");
const reviewRoutes       = require("./routes/reviewRoutes");
const chatRoutes         = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const disputeRoutes      = require("./routes/disputeRoutes");
const quoteRoutes        = require("./routes/quoteRoutes");
const adminRoutes        = require("./routes/adminRoutes");

// ── Middleware imports ─────────────────────────────────────────────────────────
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { generalLimiter, authLimiter } = require("./middleware/rateLimiter");

const app = express();

// ── 1. Security Headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow Cloudinary images
    contentSecurityPolicy: false, // Disabled — frontend handles its own CSP
  })
);

// ── 2. CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      
      // Allow localhost origins in development
      if (process.env.NODE_ENV === "development" && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
        return callback(null, true);
      }
      
      // Check against configured origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Auth-Role"],
  })
);

// ── 3. Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ── 4. Body Parsing ────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── 5. NoSQL Injection Protection ──────────────────────────────────────────────
// Recursively strips any keys starting with "$" or containing "." from req.body, req.query, and req.params.
// Protects against NoSQL injection without interfering with internal Mongoose query operators ($in, $ne, etc.).
const sanitizeInput = (obj) => {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else {
      sanitizeInput(obj[key]);
    }
  }
};

app.use((req, res, next) => {
  if (req.body) sanitizeInput(req.body);
  if (req.query) sanitizeInput(req.query);
  if (req.params) sanitizeInput(req.params);
  next();
});

// ── 6. HTTP Request Logging ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
  );
}

// ── 7. Rate Limiting ───────────────────────────────────────────────────────────
// Apply stricter rate limit to auth routes, general limit to everything else
app.use("/api/auth", authLimiter);
app.use("/api", generalLimiter);

// ── 8. Health Check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success:     true,
    message:     "HomeEase API is running 🚀",
    environment: process.env.NODE_ENV || "development",
    timestamp:   new Date().toISOString(),
    uptime:      `${Math.floor(process.uptime())}s`,
  });
});

// ── 9. API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/providers",     providerRoutes);
app.use("/api/services",      serviceRoutes);
app.use("/api/bookings",      bookingRoutes);
app.use("/api/reviews",       reviewRoutes);
app.use("/api/chats",         chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/disputes",      disputeRoutes);
app.use("/api/quotes",        quoteRoutes);
app.use("/api/admin",         adminRoutes);

// ── 10. 404 & Global Error Handler ────────────────────────────────────────────
// NOTE: These must be registered LAST
app.use(notFound);
app.use(errorHandler);

module.exports = app;
