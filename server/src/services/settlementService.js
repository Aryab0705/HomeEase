const { Provider } = require("../models/Provider");
const Payment = require("../models/Payment");

/**
 * Settle the Site Visit / Consultation Fee to Provider
 * Idempotent: safe to invoke multiple times without duplicate earnings.
 *
 * @param {object} booking Mongoose Booking document
 * @param {string} reason Reason code (e.g. VISIT_COMPLETED_CUSTOMER_PROCEEDED, VISIT_COMPLETED_CUSTOMER_DECLINED)
 * @returns {Promise<object>} updated booking
 */
async function settleToProvider(booking, reason) {
  if (booking.settlementStatus === "PROVIDER_EARNED") {
    console.log(`[Settlement] Booking ${booking._id} already settled to provider.`);
    return booking;
  }

  const feeAmount =
    booking.siteVisitFee ||
    booking.consultationFee ||
    booking.pricing?.consultationFee ||
    booking.totalAmount ||
    booking.estimatedAmount ||
    0;

  booking.siteVisitFee = feeAmount;
  booking.consultationFee = feeAmount;
  booking.settlementStatus = "PROVIDER_EARNED";
  booking.settlementReason = reason || "VISIT_COMPLETED";
  booking.settledAt = new Date();
  booking.status = "settled";

  if (!booking.statusHistory) booking.statusHistory = [];
  booking.statusHistory.push({
    status: "settled",
    note: `Site Visit / Consultation Fee of ₹${feeAmount} settled to provider. Reason: ${booking.settlementReason}.`,
    changedAt: new Date(),
  });

  // Increment provider stats
  if (booking.providerId) {
    await Provider.findByIdAndUpdate(booking.providerId, {
      $inc: {
        totalEarnings: feeAmount,
        completedJobs: 1,
      },
    });
  }

  // Update Payment record in internal ledger
  if (booking.paymentId) {
    await Payment.findByIdAndUpdate(booking.paymentId, {
      status: "settled_to_provider",
      settledAt: new Date(),
      notes: `Site visit fee settled to provider: ${booking.settlementReason}`,
    });
  }

  await booking.save();
  return booking;
}

/**
 * Refund the Site Visit / Consultation Fee to Customer
 * Idempotent: safe to invoke multiple times without duplicate refunds.
 *
 * @param {object} booking Mongoose Booking document
 * @param {string} reason Reason code (e.g. PROVIDER_NO_SHOW, PROVIDER_CANCELLED, CUSTOMER_CANCELLED_BEFORE_VISIT)
 * @returns {Promise<object>} updated booking
 */
async function refundToCustomer(booking, reason) {
  if (booking.settlementStatus === "REFUNDED") {
    console.log(`[Settlement] Booking ${booking._id} already refunded to customer.`);
    return booking;
  }

  const feeAmount =
    booking.siteVisitFee ||
    booking.consultationFee ||
    booking.pricing?.consultationFee ||
    booking.totalAmount ||
    booking.estimatedAmount ||
    0;

  booking.siteVisitFee = feeAmount;
  booking.consultationFee = feeAmount;

  booking.settlementStatus = "REFUNDED";
  booking.settlementReason = reason || "CUSTOMER_REFUND";
  booking.settledAt = new Date();
  booking.paymentStatus = "refunded";
  if (booking.pricing) {
    booking.pricing.consultationFeeRefunded = true;
  }

  if (!booking.statusHistory) booking.statusHistory = [];
  booking.statusHistory.push({
    status: booking.status,
    note: `Site Visit / Consultation Fee of ₹${feeAmount} fully refunded to customer. Reason: ${booking.settlementReason}.`,
    changedAt: new Date(),
  });

  // Update existing Payment record if exists
  if (booking.paymentId) {
    await Payment.findByIdAndUpdate(booking.paymentId, {
      status: "refunded",
      refundAmount: feeAmount,
      refundedAt: new Date(),
      notes: reason,
    });
  }

  await booking.save();
  return booking;
}

module.exports = {
  settleToProvider,
  refundToCustomer,
};
