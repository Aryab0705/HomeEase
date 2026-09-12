const express = require("express");
const router = express.Router();

const {
  initiateChat,
  getOrCreateChat,
  getMyChats,
  getMessages,
  sendMessage,
} = require("../controllers/chatController");
const { protect } = require("../middleware/auth");
const { uploadSingle } = require("../middleware/upload");

router.get("/", protect, getMyChats);
router.post("/initiate", protect, initiateChat);
router.post("/booking/:bookingId", protect, getOrCreateChat);
router.get("/:chatId/messages", protect, getMessages);
router.post("/:chatId/messages", protect, uploadSingle, sendMessage);

module.exports = router;
