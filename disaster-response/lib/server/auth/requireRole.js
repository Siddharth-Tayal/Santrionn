'use strict';

const AppError = require('../utils/AppError');

function requireRole(user, ...allowedRoles) {
  if (!user) throw AppError.unauthorized();
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    throw AppError.forbidden(`Role ${user.role} cannot perform this action`);
  }
}

module.exports = { requireRole };
