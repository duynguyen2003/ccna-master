/**
 * Middleware: Error Handling
 * PURPOSE: Handle errors and 404 not found responses
 */

const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  const errorResponse = {
    message: err.message || 'Internal Server Error',
    status: statusCode,
  };

  // In production, không cần stack trace
  if (process.env.NODE_ENV !== 'production' && err && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.json(errorResponse);
};

module.exports = { errorHandler, notFoundHandler };
