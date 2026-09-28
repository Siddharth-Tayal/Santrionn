'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLES } = require('../constants');

const BCRYPT_ROUNDS = 10;
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
      match: /^[a-z0-9._-]+$/,
      index: true,
    },
    displayName: { type: String, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: 'contributor' },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.virtual('isAdmin').get(function () { return this.role === 'admin'; });

userSchema.methods.verifyPassword = function (plaintext) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(String(plaintext || ''), this.passwordHash);
};

userSchema.statics.hashPassword = function (plaintext) {
  return bcrypt.hash(String(plaintext || ''), BCRYPT_ROUNDS);
};

/**
 * Verifies credentials. Always performs a bcrypt compare — even when the
 * user does not exist — so response timing does not reveal which usernames
 * are registered.
 */
userSchema.statics.authenticate = async function (username, password) {
  const normalised = String(username || '').trim().toLowerCase();
  const user = await this.findOne({ username: normalised }).select('+passwordHash');
  if (!user) {
    await bcrypt.compare(String(password || ''), DUMMY_HASH);
    return null;
  }
  const ok = await user.verifyPassword(password);
  return ok ? user : null;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
