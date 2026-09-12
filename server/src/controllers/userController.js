const User = require("../models/User");
const { Provider } = require("../models/Provider");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinaryService");

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/users/profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json(new ApiResponse(200, user, "Profile fetched."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ["name", "phone", "address", "email"];
  const updates = {};
  allowedFields.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  if (updates.email) {
    const existing = await User.findOne({ email: updates.email });
    if (existing && existing._id.toString() !== req.user._id.toString()) {
      throw new ApiError(409, "Email is already in use.");
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json(new ApiResponse(200, user, "Profile updated successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/change-password
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(401, "Current password is incorrect.");

  user.password = newPassword;
  await user.save();

  res.status(200).json(new ApiResponse(200, null, "Password changed successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/avatar
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No image file provided.");

  const user = await User.findById(req.user._id);

  // Delete old avatar from Cloudinary
  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId);
  }

  const result = await uploadToCloudinary(req.file.buffer, "avatars");

  user.avatar = { url: result.secure_url, publicId: result.public_id };
  await user.save({ validateBeforeSave: false });

  res.status(200).json(new ApiResponse(200, { avatar: user.avatar }, "Avatar updated."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/users  (Admin only)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, isBlocked, search } = req.query;
  const query = {};

  if (role) query.role = role;
  if (isBlocked !== undefined) query.isBlocked = isBlocked === "true";
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(query)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  res.status(200).json(
    new ApiResponse(200, {
      users,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/:id/block  (Admin only)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const toggleBlockUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");
  if (user.role === "admin") throw new ApiError(403, "Cannot block an admin account.");

  user.isBlocked = !user.isBlocked;
  await user.save({ validateBeforeSave: false });

  res.status(200).json(
    new ApiResponse(200, { isBlocked: user.isBlocked }, `User ${user.isBlocked ? "blocked" : "unblocked"} successfully.`)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/users/:id  (Admin only)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");
  if (user.role === "admin") throw new ApiError(403, "Cannot delete an admin account.");

  await user.deleteOne();
  res.status(200).json(new ApiResponse(200, null, "User deleted successfully."));
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  getAllUsers,
  toggleBlockUser,
  deleteUser,
};
