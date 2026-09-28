'use strict';

const mongoose = require('mongoose');
const AppError = require('./AppError');

/** Reject a bad :id early with a 400 that names the field, not a 500 in Mongoose. */
function toObjectId(value, field = 'id') {
  if (mongoose.isValidObjectId(value)) return new mongoose.Types.ObjectId(String(value));
  throw AppError.badRequest(`${field} must be a valid identifier`);
}

module.exports = { toObjectId };
