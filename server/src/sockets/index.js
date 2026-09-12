const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // ── Auth middleware for socket connections ─────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("Authentication token required."));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("name avatar role isBlocked");

      if (!user || user.isBlocked) return next(new Error("Unauthorized."));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Invalid or expired token."));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 Socket connected: ${socket.user.name} (${userId})`);

    // Join personal notification room
    socket.join(`user:${userId}`);

    // ── Chat Events ──────────────────────────────────────────────────────────
    socket.on("join_chat", (chatId) => {
      socket.join(`chat:${chatId}`);
      console.log(`💬 ${socket.user.name} joined chat: ${chatId}`);
    });

    socket.on("leave_chat", (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on("send_message", async (data) => {
      try {
        const { chatId, content, type = "text" } = data;

        const chat = await Chat.findById(chatId);
        if (!chat) return;

        const isMember = chat.participants.some(
          (p) => p.toString() === userId
        );
        if (!isMember) return;

        const message = await Message.create({
          chatId,
          senderId: socket.user._id,
          type,
          content,
        });

        chat.lastMessage = message._id;
        chat.lastMessageAt = new Date();
        await chat.save();

        await message.populate("senderId", "name avatar");

        // Broadcast to all chat members
        io.to(`chat:${chatId}`).emit("new_message", message);

        // Notify offline members
        chat.participants.forEach((participantId) => {
          if (participantId.toString() !== userId) {
            io.to(`user:${participantId.toString()}`).emit("message_notification", {
              chatId,
              message,
              from: { name: socket.user.name, avatar: socket.user.avatar },
            });
          }
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    socket.on("typing", ({ chatId, isTyping }) => {
      socket.to(`chat:${chatId}`).emit("user_typing", {
        userId,
        name: socket.user.name,
        isTyping,
      });
    });

    // ── Booking Tracking Events ──────────────────────────────────────────────
    // ── Booking Tracking Events ──────────────────────────────────────────────
    const handleJoinBooking = async (data) => {
      try {
        const bookingId = typeof data === "object" ? data.bookingId : data;
        if (!bookingId) return;

        const { Booking } = require("../models/Booking");
        const { Provider } = require("../models/Provider");

        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        let isAuthorized = false;
        if (socket.user.role === "admin" || socket.user.role === "super_admin") {
          isAuthorized = true;
        } else if (socket.user.role === "customer" && booking.customerId.toString() === userId) {
          isAuthorized = true;
        } else if (socket.user.role === "provider") {
          const provider = await Provider.findOne({ userId: socket.user._id });
          if (provider && booking.providerId.toString() === provider._id.toString()) {
            isAuthorized = true;
          }
        }

        if (isAuthorized) {
          socket.join(`booking:${bookingId}`);
          console.log(`📌 ${socket.user.name} (${socket.user.role}) joined room: booking:${bookingId}`);
        } else {
          console.warn(`⛔ ${socket.user.name} unauthorized for room: booking:${bookingId}`);
        }
      } catch (err) {
        console.error("Error joining booking room:", err.message);
      }
    };

    socket.on("join_booking", handleJoinBooking);
    socket.on("joinBooking", handleJoinBooking);

    // ── Provider Reputation Room ─────────────────────────────────────────────
    // Anyone viewing a provider's public profile or the provider's own
    // dashboard joins this room to receive live review / rating updates.
    // Read-only room: joining exposes nothing that isn't already public.
    const handleJoinProvider = (data) => {
      const providerId = typeof data === "object" ? data?.providerId : data;
      if (!providerId || !/^[a-f\d]{24}$/i.test(String(providerId))) return;
      socket.join(`provider:${providerId}`);
    };

    const handleLeaveProvider = (data) => {
      const providerId = typeof data === "object" ? data?.providerId : data;
      if (!providerId) return;
      socket.leave(`provider:${providerId}`);
    };

    socket.on("join_provider", handleJoinProvider);
    socket.on("leave_provider", handleLeaveProvider);

    // Live GPS Location Tracking & Geofence Handler
    socket.on("provider_location_update", async (data) => {
      try {
        console.log("RECEIVED PROVIDER LOCATION", data);
        const { bookingId, latitude, longitude, lat, lng, accuracy, timestamp } = data || {};
        const provLat = latitude ?? lat;
        const provLng = longitude ?? lng;

        if (!bookingId || provLat == null || provLng == null) {
          console.warn("⚠️ Invalid provider_location_update payload:", data);
          return;
        }

        const { Booking } = require("../models/Booking");
        const { Provider } = require("../models/Provider");

        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        // Verify socket user is the assigned provider
        const provider = await Provider.findOne({ userId: socket.user._id });
        if (!provider || booking.providerId.toString() !== provider._id.toString()) {
          console.warn(`⛔ Unauthorized location update attempt by socket user ${socket.user._id}`);
          return;
        }

        const { evaluateArrivalGeofence } = require("../utils/geoUtils");

        booking.currentProviderLocation = { lat: provLat, lng: provLng, updatedAt: new Date() };

        // Provider must manually click "Start Journey / On The Way".
        // Do NOT trigger ON_THE_WAY automatically from GPS.
        // On every provider GPS update, evaluate arrival geofence (Haversine <= 100m)
        const geofenceResult = await evaluateArrivalGeofence(booking, provLat, provLng, 100);
        const { statusChanged, distanceKm, distanceMeters, custLat, custLng } = geofenceResult;

        booking.markModified("currentProviderLocation");
        await booking.save();

        const updatePayload = {
          bookingId: booking._id.toString(),
          latitude: Number(provLat),
          longitude: Number(provLng),
          lat: Number(provLat),
          lng: Number(provLng),
          customerDestination: (custLat != null && custLng != null) ? { latitude: custLat, longitude: custLng } : null,
          accuracy: accuracy || null,
          timestamp: timestamp || new Date().toISOString(),
          distanceKm: distanceKm != null ? Number(distanceKm.toFixed(3)) : null,
          distanceMeters: distanceMeters != null ? Math.round(distanceMeters) : null,
          status: booking.status,
          location: { lat: Number(provLat), lng: Number(provLng), updatedAt: booking.currentProviderLocation.updatedAt },
        };

        // Broadcast GPS location to room
        io.to(`booking:${bookingId}`).emit("provider_location_updated", updatePayload);
        io.to(`booking:${bookingId}`).emit("provider_location", updatePayload);

        console.log(`📡 Broadcasted GPS location for booking ${bookingId}: lat=${provLat}, lng=${provLng}, dist=${distanceKm != null ? distanceKm.toFixed(2) + 'km' : 'N/A'}, status=${booking.status}`);

        // If status auto-transitioned to ARRIVED, emit status update immediately
        if (statusChanged && booking.status === "arrived") {
          const statusPayload = {
            bookingId: booking._id.toString(),
            status: "arrived",
            updatedAt: booking.updatedAt,
            booking,
            note: "Provider has arrived at destination",
          };
          io.to(`booking:${bookingId}`).emit("booking:statusUpdated", statusPayload);
          io.to(`user:${booking.customerId.toString()}`).emit("booking:statusUpdated", statusPayload);
          console.log(`🔔 Broadcasted ARRIVED status to booking:${bookingId} and user:${booking.customerId.toString()}`);
        }
      } catch (err) {
        console.error("Error handling provider location update:", err.message);
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

module.exports = initSocket;
