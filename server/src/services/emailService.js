const nodemailer = require("nodemailer");

/**
 * Create reusable transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: false, // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send a generic email
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1E293B;">Password Reset Request</h2>
      <p>Hi ${user.name},</p>
      <p>You requested to reset your password. Click the button below to reset it:</p>
      <a href="${resetUrl}" style="
        display: inline-block;
        padding: 12px 24px;
        background-color: #ABC4FF;
        color: #1E293B;
        text-decoration: none;
        border-radius: 8px;
        font-weight: bold;
        margin: 16px 0;
      ">Reset Password</a>
      <p style="color: #64748B; font-size: 14px;">This link expires in 15 minutes.</p>
      <p style="color: #64748B; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #E2EAFC; margin: 20px 0;" />
      <p style="color: #64748B; font-size: 12px;">HomeEase – Home Service Marketplace</p>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject: "Password Reset – HomeEase",
    html,
    text: `Reset your password: ${resetUrl}`,
  });
};

/**
 * Send booking confirmation email
 */
const sendBookingConfirmationEmail = async (user, booking) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1E293B;">Booking Confirmed!</h2>
      <p>Hi ${user.name},</p>
      <p>Your booking has been confirmed. Here are the details:</p>
      <div style="background: #F8FAFC; border: 1px solid #E2EAFC; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${booking.serviceId?.name || "Service"}</p>
        <p><strong>Date:</strong> ${new Date(booking.scheduledDate).toLocaleDateString("en-IN")}</p>
        <p><strong>Status:</strong> ${booking.status}</p>
      </div>
      <p style="color: #64748B; font-size: 14px;">Thank you for choosing HomeEase!</p>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject: "Booking Confirmed – HomeEase",
    html,
    text: `Your booking ${booking._id} has been confirmed.`,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
};
