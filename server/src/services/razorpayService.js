const crypto = require("crypto");
let Razorpay;
try {
  Razorpay = require("razorpay");
} catch (err) {
  console.warn("Razorpay package not found, falling back to mock mode.");
}

const key_id = process.env.RAZORPAY_KEY_ID || "";
const key_secret = process.env.RAZORPAY_KEY_SECRET || "";

const isMockMode =
  !Razorpay ||
  !key_id ||
  key_id === "your_razorpay_key_id" ||
  !key_secret ||
  key_secret === "your_razorpay_key_secret";

let razorpayInstance = null;
if (!isMockMode && Razorpay) {
  razorpayInstance = new Razorpay({
    key_id,
    key_secret,
  });
}

/**
 * Create a Razorpay Order for Site Visit / Consultation Fee
 * @param {number} amount Amount in INR (will be converted to paise)
 * @param {string} receipt Receipt ID / Booking ID
 * @param {object} notes Metadata notes
 */
async function createOrder(amount, receipt, notes = {}) {
  const amountInPaise = Math.round(amount * 100);

  if (isMockMode || !razorpayInstance) {
    const mockOrderId = "order_mock_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    return {
      id: mockOrderId,
      amount: amountInPaise,
      currency: "INR",
      receipt: String(receipt),
      status: "created",
      isMock: true,
      keyId: "mock_key_homeease",
    };
  }

  const options = {
    amount: amountInPaise,
    currency: "INR",
    receipt: String(receipt).slice(0, 40),
    notes,
  };

  const order = await razorpayInstance.orders.create(options);
  return {
    ...order,
    isMock: false,
    keyId: key_id,
  };
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId Razorpay order ID
 * @param {string} paymentId Razorpay payment ID
 * @param {string} signature Razorpay signature
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (isMockMode) {
    return true;
  }

  const generatedSignature = crypto
    .createHmac("sha256", key_secret)
    .update(orderId + "|" + paymentId)
    .digest("hex");

  return generatedSignature === signature;
}

module.exports = {
  createOrder,
  verifyPaymentSignature,
  isMockMode,
  getKeyId: () => (isMockMode ? "mock_key_homeease" : key_id),
};
