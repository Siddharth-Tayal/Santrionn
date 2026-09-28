'use strict';

const mongoose = require('mongoose');
const config = require('./config/env');
const logger = require('./utils/logger');

mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

/**
 * Next.js dev-mode hot-reload evaluates each API module afresh on every
 * request, which would otherwise open a new connection each time. Caching on
 * `global` survives hot-reload; in production each Node worker holds its own.
 */
let cached = global.__mongoose;
if (!cached) cached = global.__mongoose = { conn: null, promise: null };

async function connectDatabase() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.MONGODB_URI, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 8000,
        autoIndex: config.NODE_ENV !== 'production',
      })
      .then((m) => {
        logger.info('mongodb connected');
        return m;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

async function disconnectDatabase() {
  if (!cached.conn) return;
  await mongoose.disconnect();
  cached.conn = null;
  cached.promise = null;
  logger.warn('mongodb disconnected');
}

async function syncIndexes() {
  await connectDatabase();
  const names = Object.keys(mongoose.models);
  await Promise.all(names.map((n) => mongoose.model(n).syncIndexes()));
  logger.info('mongodb indexes synchronised');
}

module.exports = { connectDatabase, disconnectDatabase, syncIndexes };
