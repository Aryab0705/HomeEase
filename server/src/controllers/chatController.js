const User = require("../models/User");
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const { Booking } = require("../models/Booking");
const { Provider } = require("../models/Provider");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { uploadToCloudinary } = require("../services/cloudinaryService");

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/chats/initiate
// @access  Private — create or get direct 1-on-1 chat between Customer & Provider
// ─────────────────────────────────────────────────────────────────────────────
const initiateChat = asyncHandler(async (req, res) => {
  const { recipientUserId, bookingId } = req.body;

  if (!recipientUserId && !bookingId) {
    throw new ApiError(400, "Recipient user ID or booking ID is required.");
  }

  let targetUserId = recipientUserId;
  let linkedBookingId = bookingId;

  if (bookingId) {
    const booking = await Booking.findById(bookingId).populate({
      path: "providerId",
      select: "userId",
    });
    if (!booking) throw new ApiError(404, "Booking not found.");
    linkedBookingId = booking._id;

    // Determine target recipient based on logged-in user
    if (booking.customerId.toString() === req.user._id.toString()) {
      targetUserId = booking.providerId.userId.toString();
    } else {
      const provider = await Provider.findOne({ userId: req.user._id });
      if (provider && booking.providerId._id.toString() === provider._id.toString()) {
        targetUserId = booking.customerId.toString();
      } else {
        throw new ApiError(403, "Not authorized to access this booking chat.");
      }
    }
  }

  const recipient = await User.findById(targetUserId).select("name email role avatar isBlocked");
  if (!recipient) throw new ApiError(404, "Recipient user not found.");

  if (recipient._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, "You cannot start a conversation with yourself.");
  }

  // Enforce Customer ↔ Provider participant requirement
  const isReqCustomer = req.user.role === "customer";
  const isReqProvider = req.user.role === "provider";
  const isRecCustomer = recipient.role === "customer";
  const isRecProvider = recipient.role === "provider";

  if ((isReqCustomer && isRecCustomer) || (isReqProvider && isRecProvider)) {
    throw new ApiError(400, "Conversations are only permitted between Customers and Providers.");
  }

  // Check if a chat already exists between these two participants
  let chat = await Chat.findOne({
    $and: [
      { participants: req.user._id },
      { participants: recipient._id },
    ],
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [req.user._id, recipient._id],
      bookingId: linkedBookingId || undefined,
    });
  }

  await chat.populate("participants", "name avatar role email");

  res.status(200).json(new ApiResponse(200, chat, "Conversation initiated successfully."));
});

// Legacy booking endpoint wrapper for backward compatibility
const getOrCreateChat = asyncHandler(async (req, res) => {
  req.body = { bookingId: req.params.bookingId };
  return initiateChat(req, res);
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/chats
// @access  Private — get all chats for logged-in user
// ─────────────────────────────────────────────────────────────────────────────
const getMyChats = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ participants: req.user._id, isActive: true })
    .populate("participants", "name avatar role")
    .populate("lastMessage")
    .populate("bookingId", "status scheduledDate")
    .sort({ lastMessageAt: -1 });

  res.status(200).json(new ApiResponse(200, chats));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/chats/:chatId/messages
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMessages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const chat = await Chat.findById(req.params.chatId);
  if (!chat) throw new ApiError(404, "Chat not found.");

  const isMember = chat.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isMember && req.user.role !== "admin") throw new ApiError(403, "Not authorized.");

  const messages = await Message.find({ chatId: req.params.chatId, isDeleted: false })
    .populate("senderId", "name avatar role")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  // Mark messages as read
  await Message.updateMany(
    { chatId: req.params.chatId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  res.status(200).json(
    new ApiResponse(200, { messages: messages.reverse(), total: messages.length })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/chats/:chatId/messages
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const sendMessage = asyncHandler(async (req, res) => {
  const { content, type = "text" } = req.body;

  const chat = await Chat.findById(req.params.chatId);
  if (!chat) throw new ApiError(404, "Chat not found.");

  const isMember = chat.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isMember) throw new ApiError(403, "Not authorized.");

  let image;
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, "chat-images");
    image = { url: result.secure_url, publicId: result.public_id };
  }

  const message = await Message.create({
    chatId: chat._id,
    senderId: req.user._id,
    type: req.file ? "image" : type,
    content: content || "",
    image,
  });

  // Update chat last message
  chat.lastMessage = message._id;
  chat.lastMessageAt = new Date();
  await chat.save();

  await message.populate("senderId", "name avatar role");

  // Emit socket event if io instance is present
  const io = req.app.get("io");
  if (io) {
    io.to(`chat:${chat._id}`).emit("new_message", message);
    chat.participants.forEach((pId) => {
      if (pId.toString() !== req.user._id.toString()) {
        io.to(`user:${pId.toString()}`).emit("message_notification", {
          chatId: chat._id,
          message,
          from: { name: req.user.name, avatar: req.user.avatar },
        });
      }
    });
  }

  res.status(201).json(new ApiResponse(201, message, "Message sent."));
});

module.exports = { initiateChat, getOrCreateChat, getMyChats, getMessages, sendMessage };
