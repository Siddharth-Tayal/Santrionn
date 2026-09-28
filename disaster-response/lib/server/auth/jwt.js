'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');

const ISSUER = 'disaster-response';
const AUDIENCE = 'disaster-response-web';

function signAccessToken(user) {
  return jwt.sign(
    { role: user.role, username: user.username },
    config.JWT_SECRET,
    {
      subject: String(user._id),
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );
}

function verifyAccessToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, config.JWT_SECRET, { issuer: ISSUER, audience: AUDIENCE });
  } catch {
    return null;
  }
}

module.exports = { signAccessToken, verifyAccessToken };
