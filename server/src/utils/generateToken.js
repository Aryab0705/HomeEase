const jwt = require("jsonwebtoken");

/**
 * Generate access and refresh tokens for a user
 */
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "15m",
  });

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d" }
  );

  return { accessToken, refreshToken };
};

/**
 * Send tokens as HTTP-only cookies + JSON response
 */
const sendTokenResponse = (res, statusCode, user, message) => {
  const { accessToken, refreshToken } = generateTokens(user._id);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const cookieName = `refreshToken_${user.role}`;

  res
    .status(statusCode)
    .cookie(cookieName, refreshToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions) // legacy fallback
    .json({
      success: true,
      message,
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        isVerified: user.isVerified,
      },
    });
};

module.exports = { generateTokens, sendTokenResponse };
