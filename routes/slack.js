const express = require("express");
const router = express.Router();
const slackController = require("../controllers/slackController");

// Handle Slack interactions (button clicks, modal submissions)
router.post("/interactions", slackController.handleInteraction);

// Slack Events API verification
router.post("/events", (req, res) => {
  // Verify Slack challenge
  if (req.body.type === "url_verification") {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // For other events, acknowledge receipt
  res.status(200).send("");
});

module.exports = router;
