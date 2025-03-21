// Load environment variables first, before any other imports
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const { WebClient } = require("@slack/web-api");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Environment validation - check critical variables
const requiredEnvVars = [
  "MONGODB_URI",
  "TELEGRAM_BOT_TOKEN",
  "SLACK_BOT_TOKEN",
  "DEEPSEEK_API_KEY",
  "GEMINI_API_KEY",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(
    `ERROR: Missing required environment variables: ${missingVars.join(", ")}`
  );
  console.error("Please check your .env file and try again.");
  process.exit(1);
}

// Import controllers
const telegramController = require("./controllers/telegramController");

// Import routes
const telegramRoutes = require("./routes/telegram");
const slackRoutes = require("./routes/slack");

// Import error handlers
const { errorHandler, notFound } = require("./utils/errorHandler");
const logger = require("./utils/logger");

// Create required directories
const dirs = ["logs", "temp"];
for (const dir of dirs) {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
}

// Initialize Express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Log environment (redacted)
logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
logger.info(
  `DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY.substring(0, 5)}...`
);
logger.info(
  `TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 5)}...`
);

// Database connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info("Connected to MongoDB");

    // Initialize services after MongoDB connection
    initializeServices();
  })
  .catch((err) => {
    logger.error(`Could not connect to MongoDB: ${err.message}`);
    process.exit(1);
  });

function initializeServices() {
  // Initialize Telegram bot
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: true,
  });

  // Register message handler with the bot
  bot.on("message", (msg) => telegramController.processMessage(msg, bot));

  // Initialize Slack client
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

  // Global variables to share between modules
  app.locals.bot = bot;
  app.locals.slack = slack;

  logger.info("Telegram bot initialized and listening for messages");

  // Routes
  app.use("/telegram", telegramRoutes);
  app.use("/slack", slackRoutes);

  // Health check route
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Error handlers
  app.use(notFound);
  app.use(errorHandler);

  // Start the server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

// Export for testing
module.exports = app;
