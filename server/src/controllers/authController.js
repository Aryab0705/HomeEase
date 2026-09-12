const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { Provider } = require("../models/Provider");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { sendTokenResponse, generateTokens } = require("../utils/generateToken");
const {
  sendPasswordResetEmail,
} = require("../services/emailService");

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, serviceCategory, experience, hourlyRate, serviceArea, bio, workingHoursStart, workingHoursEnd } = req.body;

  // Check duplicate email
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "An account with this email already exists.");

  // Prevent direct admin or super_admin registration
  if (role === "admin" || role === "super_admin") {
    throw new ApiError(403, "Admin accounts cannot be publicly registered.");
  }

  const user = await User.create({ name, email, password, role: role || "customer", phone });

  // Auto-create provider profile if role is provider with additional fields
  if (user.role === "provider") {
    const rate = Number(hourlyRate || 500);
    const providerData = {
      userId: user._id,
      bio: bio || "Experienced home service provider.",
      experience: Number(experience || 0),
      primaryCategory: serviceCategory || undefined,
      subCategories: serviceCategory ? [serviceCategory] : [],
      skills: serviceCategory ? [serviceCategory] : [],
      languages: [],
      hourlyRate: rate,
      startingPrice: rate,
      emergencyService: false,
      services: serviceCategory ? [{
        category: serviceCategory,
        name: serviceCategory,
        description: bio || "Professional service provider",
        basePrice: rate,
        priceUnit: "per hour",
      }] : [],
      verificationStatus: "pending",
      serviceArea: {
        city: serviceArea || "",
        state: "",
        radius: 20,
      },
      availability: {
        isAvailable: true,
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        workingHours: {
          start: workingHoursStart || "09:00",
          end: workingHoursEnd || "18:00",
        },
      },
    };
    await Provider.create(providerData);
  }

  sendTokenResponse(res, 201, user, "Account created successfully.");
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) throw new ApiError(401, "Invalid email or password.");

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, "Invalid email or password.");

  if (user.isBlocked) throw new ApiError(403, "Your account has been suspended.");

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(res, 200, user, "Logged in successfully.");
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

  const role = req.user.role;
  res
    .clearCookie(`refreshToken_${role}`)
    .clearCookie("refreshToken")
    .clearCookie("accessToken")
    .status(200)
    .json(new ApiResponse(200, null, "Logged out successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/refresh-token
// @access  Public (uses cookie)
// ─────────────────────────────────────────────────────────────────────────────
const refreshToken = asyncHandler(async (req, res) => {
  const reqRole = req.headers["x-auth-role"] || req.body?.role;
  const roleCookie = reqRole ? req.cookies?.[`refreshToken_${reqRole}`] : null;
  const token = roleCookie || req.cookies?.refreshToken;

  if (!token) throw new ApiError(401, "No refresh token provided.");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token.");
  }

  const user = await User.findById(decoded.id);
  if (!user || user.isBlocked) throw new ApiError(401, "Invalid session.");

  const { accessToken } = generateTokens(user._id);

  res.status(200).json(
    new ApiResponse(200, { accessToken }, "Token refreshed successfully.")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/forgot-password
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw new ApiError(404, "No account found with that email address.");

  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetEmail(user, resetToken);
    res.status(200).json(
      new ApiResponse(200, null, `Password reset link sent to ${user.email}.`)
    );
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(500, "Email could not be sent. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/reset-password/:token
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = asyncHandler(async (req, res) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) throw new ApiError(400, "Password reset token is invalid or has expired.");

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(res, 200, user, "Password reset successful. You are now logged in.");
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json(new ApiResponse(200, user, "User profile fetched."));
});

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
};
