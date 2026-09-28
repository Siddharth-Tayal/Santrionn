'use strict';

/**
 * Errors thrown by controllers/services. The error middleware turns any
 * AppError into the standard { success:false, error:{code,message,details} }
 * envelope. Anything that is not an AppError is treated as a 500.
 */
class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details) { return new AppError(message, { status: 400, code: 'BAD_REQUEST', details }); }
  static unauthorized(message = 'Authentication required') { return new AppError(message, { status: 401, code: 'UNAUTHORIZED' }); }
  static forbidden(message = 'Forbidden') { return new AppError(message, { status: 403, code: 'FORBIDDEN' }); }
  static notFound(message = 'Not found') { return new AppError(message, { status: 404, code: 'NOT_FOUND' }); }
  static conflict(message, details) { return new AppError(message, { status: 409, code: 'CONFLICT', details }); }
  static validation(message = 'Validation failed', details) { return new AppError(message, { status: 422, code: 'VALIDATION_ERROR', details }); }
  static rateLimited(message = 'Too many requests') { return new AppError(message, { status: 429, code: 'RATE_LIMITED' }); }
  static badGateway(message = 'Upstream service unavailable') { return new AppError(message, { status: 502, code: 'BAD_GATEWAY' }); }
}

module.exports = AppError;
