const axios = require("axios");
const logger = require("../utils/logger");

/**
 * Robust DeepSeek AI Service for generating answers to student questions
 * With retry logic and detailed error handling
 */
class DeepseekService {
  constructor() {
    // Ensure API key is directly from environment, not from a cached import
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.apiUrl = "https://api.deepseek.com/v1/chat/completions";

    // Simplify the system prompt to reduce potential issues
    this.systemPrompt = `You are an expert tutor. Explain concepts simply with proper math notation.`;

    // Configuration for retries
    this.maxRetries = 2;
    this.retryDelay = 1000; // ms

    logger.info(
      `RobustDeepseekService initialized with API key (first 5 chars): ${
        this.apiKey ? this.apiKey.substring(0, 5) + "..." : "undefined"
      }`
    );
  }

  /**
   * Generate an answer for a student question with retries
   * @param {string} question - The student's question
   * @returns {Promise<string>} - AI generated answer
   */
  async generateAnswer(question) {
    let retries = 0;
    let lastError = null;

    while (retries <= this.maxRetries) {
      try {
        if (retries > 0) {
          logger.info(
            `Retry attempt ${retries} for question: ${question.substring(
              0,
              30
            )}...`
          );
          // Wait before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * retries)
          );
        }

        return await this._makeRequest(question);
      } catch (error) {
        lastError = error;
        logger.error(
          `DeepSeek API error (attempt ${retries + 1}): ${error.message}`
        );
        retries++;
      }
    }

    // If we've exhausted retries, try a simplified request
    try {
      logger.info(`Trying simplified request as last resort...`);
      return await this._makeSimplifiedRequest(question);
    } catch (error) {
      logger.error(`Simplified request also failed: ${error.message}`);
      // Finally, give up and provide a fallback response
      return this._getFallbackResponse(question);
    }
  }

  /**
   * Make the primary API request
   * @private
   */
  async _makeRequest(question) {
    logger.info(
      `Making DeepSeek API request for question: ${question.substring(
        0,
        50
      )}...`
    );

    try {
      // Use a simple request structure that worked in tests
      const response = await axios.post(
        this.apiUrl,
        {
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: this.systemPrompt,
            },
            {
              role: "user",
              content: question,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000, // 30 second timeout
        }
      );

      if (
        response.data &&
        response.data.choices &&
        response.data.choices.length > 0
      ) {
        const answer = response.data.choices[0].message.content;
        logger.info(
          `Successfully received answer from DeepSeek (${answer.length} chars)`
        );
        return answer;
      } else {
        throw new Error("Invalid response format from DeepSeek API");
      }
    } catch (error) {
      // Enhanced error logging
      if (error.response) {
        logger.error(`DeepSeek API status: ${error.response.status}`);
        logger.error(
          `DeepSeek API response: ${JSON.stringify(error.response.data)}`
        );

        // Log request details that might be causing the issue
        logger.error(
          `Request config: ${JSON.stringify({
            url: error.config.url,
            method: error.config.method,
            headers: {
              "Content-Type": error.config.headers["Content-Type"],
              Authorization: "Bearer [REDACTED]",
            },
          })}`
        );
      } else if (error.request) {
        logger.error(
          `No response received from DeepSeek. Request: ${error.request}`
        );
      }

      throw error; // Let the retry mechanism handle it
    }
  }

  /**
   * Make a simplified API request as a last resort
   * @private
   */
  async _makeSimplifiedRequest(question) {
    logger.info(`Making simplified DeepSeek API request...`);

    const response = await axios.post(
      this.apiUrl,
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: `Answer this as briefly as possible: ${question}`,
          },
        ],
        max_tokens: 100,
        temperature: 0.5,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 15000, // 15 second timeout
      }
    );

    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error(
        "Invalid response format from simplified DeepSeek API request"
      );
    }
  }

  /**
   * Get a fallback response when all API calls fail
   * @private
   */
  _getFallbackResponse(question) {
    logger.info(
      `Generating fallback response for: ${question.substring(0, 30)}...`
    );

    const q = question.toLowerCase();

    if (
      q.includes("math") ||
      q.includes("formula") ||
      q.includes("equation") ||
      q.includes("calculate")
    ) {
      return "The formula you're asking about appears to involve mathematical concepts. A teacher will review your question and provide a detailed answer shortly.";
    } else if (
      q.includes("physics") ||
      q.includes("force") ||
      q.includes("energy") ||
      q.includes("motion")
    ) {
      return "Your physics question requires careful explanation. A teacher will review your question and provide a detailed answer shortly.";
    } else if (
      q.includes("chemistry") ||
      q.includes("reaction") ||
      q.includes("molecule")
    ) {
      return "Your chemistry question involves specific concepts. A teacher will review your question and provide a detailed answer shortly.";
    } else {
      return "I'll help with your question. A teacher will review it and provide a detailed answer shortly.";
    }
  }
}

module.exports = new DeepseekService();
