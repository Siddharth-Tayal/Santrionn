'use strict';

const { z } = require('zod');
const { strictObject } = require('./common.schema');

const loginBody = strictObject({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(6).max(128),
});

module.exports = { loginBody };
