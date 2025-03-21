const logger = require("../utils/logger");
const fs = require("fs");
const path = require("path");

/**
 * Mock Gemini Service for processing images when the real API isn't working
 */
class GeminiService {
  constructor() {
    logger.info("Mock Gemini Service initialized");
  }

  /**
   * Extract text from an image (mock implementation)
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>} - Extracted text
   */
  async extractTextFromImage(imagePath) {
    try {
      logger.info(`Processing image: ${imagePath}`);

      // Save a copy of the image for debugging
      const debugDir = path.join(__dirname, "..", "debug");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      const filename = path.basename(imagePath);
      const debugPath = path.join(debugDir, `debug-${filename}`);
      fs.copyFileSync(imagePath, debugPath);

      logger.info(`Saved debug copy of image to: ${debugPath}`);

      // Generate a mock extracted text based on image extension
      const ext = path.extname(imagePath).toLowerCase();
      let extractedText = "";

      if (ext === ".jpg" || ext === ".jpeg") {
        extractedText =
          "Find the derivative of f(x) = 3x² + 2x - 5 with respect to x.";
      } else if (ext === ".png") {
        extractedText =
          "If a circle has a radius of 5 cm, calculate its area and circumference.";
      } else {
        extractedText = "Solve the following equation: 2x + 5 = 13";
      }

      logger.info(`Generated mock text from image: "${extractedText}"`);

      return extractedText;
    } catch (error) {
      logger.error(`Error in mock image processing: ${error.message}`);
      return "This appears to be an image with a question. A teacher will review it shortly.";
    }
  }
}

module.exports = new GeminiService();
