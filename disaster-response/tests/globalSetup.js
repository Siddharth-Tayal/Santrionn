'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-characters-long';
  process.env.GEOCODER_PROVIDER = 'mock';
  process.env.SOCIAL_API_FAILURE_RATE = '0';
  global.__MONGOD__ = mongod;
};
