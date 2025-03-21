const express = require("express");
const router = express.Router();
const telegramController = require("../controllers/telegramController");

// No routes needed as we're using the TelegramBot polling mechanism
// But we can add webhook support if needed in the future
router.post("/webhook", (req, res) => {
  res.status(200).send("Webhook received");
});

module.exports = router;
