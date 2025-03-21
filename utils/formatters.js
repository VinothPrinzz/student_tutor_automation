/**
 * Format error message for consistent logging
 * @param {string} message - Error message
 * @param {Error} [error] - Error object
 * @returns {Object} - Formatted error object
 */
exports.formatError = (message, error) => {
  return {
    message,
    error: error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined,
  };
};

/**
 * Format success message for consistent logging
 * @param {string} message - Success message
 * @param {Object} [data] - Additional data
 * @returns {Object} - Formatted success object
 */
exports.formatSuccess = (message, data) => {
  return {
    message,
    data,
  };
};
