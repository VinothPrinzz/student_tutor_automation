const { WebClient } = require("@slack/web-api");
const logger = require("../utils/logger");

/**
 * Service for handling Slack interactions
 */
class SlackService {
  constructor() {
    this.token = process.env.SLACK_BOT_TOKEN;
    this.slackClient = new WebClient(this.token);
    this.channelId = process.env.SLACK_CHANNEL_ID || "testing"; // Default channel name
  }

  /**
   * Send a question and answer to Slack for teacher approval
   * @param {string} question - Student's question
   * @param {string} answer - AI generated answer
   * @param {string} recordId - Database record ID
   * @param {string} studentName - Student's name
   * @param {boolean} isFromImage - Whether the question came from an image
   * @returns {Promise<Object>} - Slack API response
   */
  async sendQuestionForApproval(
    question,
    answer,
    recordId,
    studentName,
    isFromImage = false
  ) {
    try {
      const blocks = [
        {
          type: "rich_text",
          elements: [
            {
              type: "rich_text_section",
              elements: [
                {
                  type: "text",
                  text: question,
                  style: {
                    bold: true,
                  },
                },
              ],
            },
          ],
        },
        {
          type: "divider",
        },
        {
          type: "rich_text",
          elements: [
            {
              type: "rich_text_section",
              elements: [
                {
                  type: "text",
                  text: answer,
                  style: {
                    bold: true,
                  },
                },
              ],
            },
          ],
        },
        {
          type: "actions",
          block_id: "approval_buttons",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                emoji: true,
                text: "Approve",
              },
              style: "primary",
              value: recordId.toString(),
              action_id: "approve_button",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                emoji: true,
                text: "Edit",
              },
              style: "danger",
              value: recordId.toString(),
              action_id: "edited_button",
            },
          ],
        },
      ];

      // Add a context block to show where the question came from
      blocks.unshift({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*From:* ${studentName} | *Source:* ${
              isFromImage ? "Image" : "Text"
            }`,
          },
        ],
      });

      const result = await this.slackClient.chat.postMessage({
        channel: this.channelId,
        blocks: blocks,
        text: `New question from ${studentName}: ${question.substring(
          0,
          50
        )}...`, // Fallback text
      });

      return result;
    } catch (error) {
      logger.error(`Error sending message to Slack: ${error.message}`);
      throw new Error(`Failed to send message to Slack: ${error.message}`);
    }
  }

  /**
   * Update a Slack message after approval
   * @param {string} messageTs - Slack message timestamp (ID)
   * @param {string} text - Updated text
   * @returns {Promise<Object>} - Slack API response
   */
  async updateMessage(messageTs, text) {
    try {
      const result = await this.slackClient.chat.update({
        channel: this.channelId,
        ts: messageTs,
        text: text,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Approved Answer:*",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: text,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: ":white_check_mark: Approved and sent to student",
              },
            ],
          },
        ],
      });

      return result;
    } catch (error) {
      logger.error(`Error updating Slack message: ${error.message}`);
      throw new Error(`Failed to update Slack message: ${error.message}`);
    }
  }

  /**
   * Open a modal dialog for editing an answer
   * @param {string} triggerId - Slack trigger ID
   * @param {string} recordId - Database record ID
   * @param {string} channelId - Slack channel ID
   * @param {string} messageTs - Slack message timestamp
   * @param {string} question - Original question
   * @param {string} answer - Original answer
   * @returns {Promise<Object>} - Slack API response
   */
  async openEditModal(
    triggerId,
    recordId,
    channelId,
    messageTs,
    question,
    answer
  ) {
    try {
      const result = await this.slackClient.views.open({
        trigger_id: triggerId,
        view: {
          type: "modal",
          callback_id: "edit_response_modal",
          title: {
            type: "plain_text",
            text: "Edit Response",
          },
          submit: {
            type: "plain_text",
            text: "Submit",
          },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Original Question:*\n${question}`,
              },
            },
            {
              type: "input",
              block_id: "edited_response",
              element: {
                type: "plain_text_input",
                action_id: "response_text",
                multiline: true,
                initial_value: answer,
              },
              label: {
                type: "plain_text",
                text: "Edit Response",
              },
            },
          ],
          private_metadata: JSON.stringify({
            channel_id: channelId,
            message_ts: messageTs,
            data_key: recordId.toString(),
          }),
        },
      });

      return result;
    } catch (error) {
      logger.error(`Error opening edit modal: ${error.message}`);
      throw new Error(`Failed to open edit modal: ${error.message}`);
    }
  }
}

module.exports = new SlackService();
