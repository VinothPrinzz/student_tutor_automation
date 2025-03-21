const logger = require("./logger");

/**
 * Global error handler middleware for Express
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error(
    `${status} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );

  if (process.env.NODE_ENV === "development") {
    logger.error(err.stack);
  }

  res.status(status).json({
    error: {
      message: message,
      status: status,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Not found middleware for Express
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.notFound = (req, res) => {
  logger.warn(
    `404 - Not Found - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );

  res.status(404).json({
    error: {
      message: "Not Found",
      status: 404,
      timestamp: new Date().toISOString(),
    },
  });
};
