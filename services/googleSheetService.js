const { google } = require("googleapis");
const logger = require("../utils/logger");

/**
 * Service for interacting with Google Sheets API
 */
class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || "Sheet1";
    this.auth = null;
    this.sheets = null;
    this.initialized = false;
  }

  /**
   * Initialize Google Sheets API client
   */
  async initialize() {
    try {
      // Setup authentication using service account
      this.auth = new google.auth.GoogleAuth({
        keyFile: "/etc/secrets/google-credentials.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const authClient = await this.auth.getClient();
      this.sheets = google.sheets({ version: "v4", auth: authClient });
      this.initialized = true;

      logger.info("Google Sheets service initialized");
    } catch (error) {
      logger.error(`Error initializing Google Sheets: ${error.message}`);
      throw new Error(`Failed to initialize Google Sheets: ${error.message}`);
    }
  }

  /**
   * Save a record to Google Sheets
   * @param {Object} record - Record to save
   * @param {string} record.accountName - Student name
   * @param {string} record.question - Student question
   * @param {string} record.answer - Original AI answer
   * @param {string} [record.editedAnswer] - Edited answer (if provided)
   * @returns {Promise<Object>} - Google Sheets API response
   */
  async saveRecord(record) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Prepare row values
      const values = [
        [
          new Date().toISOString(), // Timestamp
          record.accountName,
          record.question,
          record.answer,
          record.editedAnswer || record.answer, // Use edited answer if available, otherwise use original
        ],
      ];

      // Append values to the spreadsheet
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:E`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values },
      });

      logger.info(
        `Record saved to Google Sheets: ${response.data.updates.updatedRange}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Error saving to Google Sheets: ${error.message}`);
      throw new Error(`Failed to save to Google Sheets: ${error.message}`);
    }
  }

  /**
   * Get all records from Google Sheets
   * @returns {Promise<Array>} - Array of records
   */
  async getAllRecords() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:E`,
      });

      const rows = response.data.values || [];

      // Convert rows to objects (assume first row is headers)
      const headers = rows[0] || [
        "timestamp",
        "accountName",
        "question",
        "answer",
        "editedAnswer",
      ];
      const records = rows.slice(1).map((row) => {
        const record = {};
        headers.forEach((header, i) => {
          record[header] = row[i] || "";
        });
        return record;
      });

      return records;
    } catch (error) {
      logger.error(
        `Error getting records from Google Sheets: ${error.message}`
      );
      throw new Error(
        `Failed to get records from Google Sheets: ${error.message}`
      );
    }
  }
}

module.exports = new GoogleSheetsService();
