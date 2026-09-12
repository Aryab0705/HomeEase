const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/notifications
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const query = { userId: req.user._id };
  if (unreadOnly === "true") query.isRead = false;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

  res.status(200).json(
    new ApiResponse(200, { notifications, total, unreadCount })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/notifications/:id/read
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const markAsRead = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notif) throw new ApiError(404, "Notification not found.");
  res.status(200).json(new ApiResponse(200, notif, "Marked as read."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/notifications/read-all
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  res.status(200).json(new ApiResponse(200, null, "All notifications marked as read."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/notifications/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteNotification = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!notif) throw new ApiError(404, "Notification not found.");
  res.status(200).json(new ApiResponse(200, null, "Notification deleted."));
});

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
