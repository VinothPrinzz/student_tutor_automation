const TelegramBot = require("node-telegram-bot-api");
const logger = require("../utils/logger");

/**
 * Service for handling Telegram bot interactions
 */
class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.bot = new TelegramBot(this.token, { polling: false });
  }

  /**
   * Initialize the Telegram bot with message handlers
   * @param {Function} messageHandler - Function to handle incoming messages
   */
  initialize(messageHandler) {
    // Create a new bot instance with polling enabled
    this.bot = new TelegramBot(this.token, { polling: true });

    // Register message handlers
    this.bot.on("message", messageHandler);

    logger.info("Telegram bot initialized and listening for messages");

    return this.bot;
  }

  /**
   * Send a message to a Telegram user
   * @param {string|number} chatId - Telegram chat ID
   * @param {string} text - Message text
   * @returns {Promise<Object>} - Telegram API response
   */
  async sendMessage(chatId, text) {
    try {
      const result = await this.bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      logger.info(`Message sent to Telegram user: ${chatId}`);
      return result;
    } catch (error) {
      logger.error(`Error sending message to Telegram: ${error.message}`);
      throw new Error(`Failed to send message to Telegram: ${error.message}`);
    }
  }

  /**
   * Download a file from Telegram
   * @param {string} fileId - Telegram file ID
   * @returns {Promise<Object>} - Object containing file path and URL
   */
  async getFile(fileId) {
    try {
      const fileInfo = await this.bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${this.token}/${fileInfo.file_path}`;

      return {
        filePath: fileInfo.file_path,
        fileUrl: fileUrl,
      };
    } catch (error) {
      logger.error(`Error getting file from Telegram: ${error.message}`);
      throw new Error(`Failed to get file from Telegram: ${error.message}`);
    }
  }
}

module.exports = new TelegramService();
