const path = require("path");
const fs = require("fs");
const axios = require("axios");
const Question = require("../models/question");
const GeminiService = require("../services/geminiService");
const DeepseekService = require("../services/deepseekService");
const slackService = require("../services/slackService");
const logger = require("../utils/logger");

/**
 * Process incoming Telegram message
 * @param {Object} msg - Telegram message object
 * @param {Object} bot - Telegram bot instance
 */
exports.processMessage = async (msg, bot) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name;

    logger.info(`Received message from ${firstName} (${userId})`);

    // Check if message has photo
    if (msg.photo && msg.photo.length > 0) {
      await processPhotoMessage(msg, bot);
    } else if (msg.text) {
      await processTextMessage(msg, bot);
    } else {
      // Unsupported message type
      await bot.sendMessage(
        chatId,
        "Sorry, I can only process text or images. Please try again."
      );
    }
  } catch (error) {
    logger.error(`Error processing Telegram message: ${error.message}`);
    try {
      await bot.sendMessage(
        msg.chat.id,
        "Sorry, there was an error processing your message. Please try again later."
      );
    } catch (sendError) {
      logger.error(`Error sending error message: ${sendError.message}`);
    }
  }
};

/**
 * Process text messages from Telegram
 * @param {Object} msg - Telegram message object
 * @param {Object} bot - Telegram bot instance
 */
async function processTextMessage(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const questionText = msg.text;

  try {
    logger.info(
      `Processing text message: "${questionText.substring(0, 50)}..."`
    );

    // Send typing indication to user
    await bot.sendChatAction(chatId, "typing");

    // 1. Generate answer using robust DeepSeek service
    let answer;
    try {
      answer = await DeepseekService.generateAnswer(questionText);
      logger.info(`Generated answer for text question`);
    } catch (aiError) {
      logger.error(`Error generating answer: ${aiError.message}`);
      answer =
        "I encountered a technical issue. A teacher will help with your question shortly.";
    }

    // 2. Store question and answer in database
    let questionData;
    try {
      questionData = new Question({
        accountId: userId,
        accountName: firstName,
        question: questionText,
        answer: answer,
        isApproved: false,
        isFromImage: false,
      });

      await questionData.save();
      logger.info(`Saved question to database with ID: ${questionData._id}`);
    } catch (dbError) {
      logger.error(`Error saving to database: ${dbError.message}`);
      // Create a temporary ID if database save fails
      questionData = {
        _id: `temp-${Date.now()}`,
        accountId: userId,
        accountName: firstName,
        question: questionText,
        answer: answer,
      };
    }

    // 3. Send to Slack for approval
    try {
      await slackService.sendQuestionForApproval(
        questionText,
        answer,
        questionData._id,
        firstName,
        false
      );
      logger.info(`Sent question to Slack for approval`);
    } catch (slackError) {
      logger.error(`Error sending to Slack: ${slackError.message}`);
      // Continue even if Slack fails
    }

    // 4. Send acknowledgment to user
    await bot.sendMessage(
      chatId,
      "I've received your question and am working on it. A teacher will review the answer shortly."
    );
    logger.info(`Sent acknowledgment to user`);
  } catch (error) {
    logger.error(`Error processing text message: ${error.message}`);
    await bot.sendMessage(
      chatId,
      "Sorry, there was an error processing your question. Please try again later."
    );
  }
}

/**
 * Process photo messages from Telegram
 * @param {Object} msg - Telegram message object
 * @param {Object} bot - Telegram bot instance
 */
async function processPhotoMessage(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;

  try {
    logger.info(`Processing photo message from ${firstName}`);

    // Send typing indication to user
    await bot.sendChatAction(chatId, "typing");

    // 1. Get the largest photo (last in array)
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;

    // 2. Download the photo
    let filePath = null;
    let fileUrl = null;

    try {
      fileUrl = await getPhotoUrl(bot, fileId);
      filePath = await downloadPhoto(fileUrl);
      logger.info(`Downloaded photo to ${filePath}`);
    } catch (downloadError) {
      logger.error(`Error downloading photo: ${downloadError.message}`);
      throw new Error(`Could not download image: ${downloadError.message}`);
    }

    // 3. Extract text from photo using Mock Gemini service
    let extractedText;
    try {
      extractedText = await GeminiService.extractTextFromImage(filePath);
      logger.info(
        `Extracted text from image: "${extractedText.substring(0, 50)}..."`
      );
    } catch (extractError) {
      logger.error(`Error extracting text: ${extractError.message}`);
      extractedText =
        "This appears to be an image with a question, but I couldn't extract the text.";
    }

    // 4. Generate answer using robust DeepSeek service
    let answer;
    try {
      answer = await DeepseekService.generateAnswer(extractedText);
      logger.info(`Generated answer for image question`);
    } catch (aiError) {
      logger.error(`Error generating answer: ${aiError.message}`);
      answer =
        "I encountered a technical issue processing this image. A teacher will help with your question shortly.";
    }

    // 5. Store question and answer in database
    let questionData;
    try {
      questionData = new Question({
        accountId: userId,
        accountName: firstName,
        question: extractedText,
        answer: answer,
        isApproved: false,
        isFromImage: true,
        imageUrl: fileUrl,
      });

      await questionData.save();
      logger.info(
        `Saved image question to database with ID: ${questionData._id}`
      );
    } catch (dbError) {
      logger.error(`Error saving to database: ${dbError.message}`);
      // Create a temporary ID if database save fails
      questionData = {
        _id: `temp-${Date.now()}`,
        accountId: userId,
        accountName: firstName,
        question: extractedText,
        answer: answer,
      };
    }

    // 6. Send to Slack for approval
    try {
      await slackService.sendQuestionForApproval(
        extractedText,
        answer,
        questionData._id,
        firstName,
        true
      );
      logger.info(`Sent image question to Slack for approval`);
    } catch (slackError) {
      logger.error(`Error sending to Slack: ${slackError.message}`);
      // Continue even if Slack fails
    }

    // 7. Send acknowledgment to user
    await bot.sendMessage(
      chatId,
      "I've received your image and am processing it. A teacher will review the answer shortly."
    );
    logger.info(`Sent acknowledgment to user for image`);

    // 8. Clean up temporary file
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up temporary file`);
      } catch (cleanupError) {
        logger.error(`Error cleaning up file: ${cleanupError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error processing photo message: ${error.message}`);
    await bot.sendMessage(
      chatId,
      "Sorry, there was an error processing your image. Please try again later."
    );
  }
}

/**
 * Get the URL of a photo from Telegram
 * @param {Object} bot - Telegram bot instance
 * @param {string} fileId - File ID from Telegram
 * @returns {Promise<string>} - File URL
 */
async function getPhotoUrl(bot, fileId) {
  try {
    const fileInfo = await bot.getFile(fileId);
    return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
  } catch (error) {
    logger.error(`Error getting file from Telegram: ${error.message}`);
    throw new Error(`Failed to get file from Telegram: ${error.message}`);
  }
}

/**
 * Download a photo from a URL to a local temporary file
 * @param {string} url - URL of the photo
 * @returns {Promise<string>} - Path to the downloaded file
 */
async function downloadPhoto(url) {
  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 15000, // 15 second timeout
    });

    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `${Date.now()}.jpg`);
    const writer = fs.createWriteStream(tempPath);

    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on("finish", () => resolve(tempPath));
      writer.on("error", reject);
    });
  } catch (error) {
    logger.error(`Error downloading photo: ${error.message}`);
    throw new Error(`Failed to download photo: ${error.message}`);
  }
}
