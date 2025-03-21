const Question = require("../models/question");
const slackService = require("../services/slackService");
const telegramService = require("../services/telegramService");
const googleSheetsService = require("../services/googleSheetService");
const logger = require("../utils/logger");

/**
 * Handle Slack interaction payloads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleInteraction = async (req, res) => {
  try {
    // Verify Slack request signature (not implemented here for brevity)

    // Parse the payload
    const payload = req.body.payload ? JSON.parse(req.body.payload) : req.body;

    // Acknowledge the request immediately
    res.status(200).send("");

    // Process based on the interaction type
    if (payload.type === "block_actions") {
      await handleBlockActions(payload);
    } else if (payload.type === "view_submission") {
      await handleViewSubmission(payload);
    } else {
      logger.warn(`Unknown Slack interaction type: ${payload.type}`);
    }
  } catch (error) {
    logger.error(`Error handling Slack interaction: ${error.message}`);
    // Already sent a 200 response, so just log the error
  }
};

/**
 * Handle block actions (button clicks)
 * @param {Object} payload - Slack payload
 */
async function handleBlockActions(payload) {
  try {
    // Get the action
    const action = payload.actions[0];
    const recordId = action.value;

    // Get the record from the database
    const questionRecord = await Question.findById(recordId);

    if (!questionRecord) {
      logger.error(`Question record not found: ${recordId}`);
      return;
    }

    // Handle based on action ID
    if (action.action_id === "approve_button") {
      await handleApproval(payload, questionRecord);
    } else if (action.action_id === "edited_button") {
      await handleEditRequest(payload, questionRecord);
    }
  } catch (error) {
    logger.error(`Error handling block actions: ${error.message}`);
  }
}

/**
 * Handle view submission (modal form submission)
 * @param {Object} payload - Slack payload
 */
async function handleViewSubmission(payload) {
  try {
    // Parse the private metadata
    const metadata = JSON.parse(payload.view.private_metadata);
    const recordId = metadata.data_key;
    const channelId = metadata.channel_id;
    const messageTs = metadata.message_ts;

    // Get the edited text
    const editedAnswer =
      payload.view.state.values.edited_response.response_text.value;

    // Get the record from the database
    const questionRecord = await Question.findById(recordId);

    if (!questionRecord) {
      logger.error(`Question record not found: ${recordId}`);
      return;
    }

    // Update the record
    questionRecord.editedAnswer = editedAnswer;
    questionRecord.isApproved = true;
    questionRecord.approvedAt = new Date();
    questionRecord.approvedBy = payload.user.id;
    await questionRecord.save();

    // Update the Slack message
    await slackService.updateMessage(messageTs, editedAnswer);

    // Send the answer to the student
    await telegramService.sendMessage(questionRecord.accountId, editedAnswer);

    // Save to Google Sheets for training data
    await googleSheetsService.saveRecord({
      accountName: questionRecord.accountName,
      question: questionRecord.question,
      answer: questionRecord.answer,
      editedAnswer: editedAnswer,
    });

    logger.info(`Edited answer sent to student: ${recordId}`);
  } catch (error) {
    logger.error(`Error handling view submission: ${error.message}`);
  }
}

/**
 * Handle approval button click
 * @param {Object} payload - Slack payload
 * @param {Object} questionRecord - Question database record
 */
async function handleApproval(payload, questionRecord) {
  try {
    // Update the record
    questionRecord.isApproved = true;
    questionRecord.approvedAt = new Date();
    questionRecord.approvedBy = payload.user.id;
    await questionRecord.save();

    // Update the Slack message
    await slackService.updateMessage(payload.message.ts, questionRecord.answer);

    // Send the answer to the student
    await telegramService.sendMessage(
      questionRecord.accountId,
      questionRecord.answer
    );

    // Save to Google Sheets for training data
    await googleSheetsService.saveRecord({
      accountName: questionRecord.accountName,
      question: questionRecord.question,
      answer: questionRecord.answer,
    });

    logger.info(`Approved answer sent to student: ${questionRecord._id}`);
  } catch (error) {
    logger.error(`Error handling approval: ${error.message}`);
  }
}

/**
 * Handle edit request button click
 * @param {Object} payload - Slack payload
 * @param {Object} questionRecord - Question database record
 */
async function handleEditRequest(payload, questionRecord) {
  try {
    // Open the edit modal
    await slackService.openEditModal(
      payload.trigger_id,
      questionRecord._id,
      payload.channel.id,
      payload.message.ts,
      questionRecord.question,
      questionRecord.answer
    );

    logger.info(`Edit modal opened for question: ${questionRecord._id}`);
  } catch (error) {
    logger.error(`Error handling edit request: ${error.message}`);
  }
}
