'use strict';

const config = require('../config/env');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.LOG_LEVEL] || 20;

function log(level, message, meta) {
  if ((LEVELS[level] || 100) < threshold) return;
  const line = { level, time: new Date().toISOString(), message };
  if (meta !== undefined) line.meta = meta;
  process.stdout.write(JSON.stringify(line) + '\n');
}

module.exports = {
  debug: (m, meta) => log('debug', m, meta),
  info: (m, meta) => log('info', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  error: (m, meta) => log('error', m, meta),
};
