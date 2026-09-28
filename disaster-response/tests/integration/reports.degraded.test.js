'use strict';

const { connectDatabase, disconnectDatabase, syncIndexes } = require('../../lib/server/db');
const Disaster = require('../../lib/server/models/Disaster');
const Report = require('../../lib/server/models/Report');
const User = require('../../lib/server/models/User');

jest.mock('../../lib/server/integrations/mockSocial', () => {
  const actual = jest.requireActual('../../lib/server/integrations/mockSocial');
  return { ...actual, fetchReports: jest.fn() };
});
const { fetchReports } = require('../../lib/server/integrations/mockSocial');
const { getReportsForDisaster } = require('../../lib/server/services/reports');
const { cache } = require('../../lib/server/services/cache');

beforeAll(async () => { await connectDatabase(); await syncIndexes(); });
afterAll(async () => { await disconnectDatabase(); });
afterEach(async () => {
  cache.clear();
  await Report.deleteMany({});
  await Disaster.deleteMany({});
  await User.deleteMany({});
});

test('falls back to stale cache when the external provider fails', async () => {
  const admin = await User.create({
    username: 'admin', role: 'admin',
    passwordHash: await User.hashPassword('x'),
  });
  const disaster = await Disaster.create({
    title: 'Manhattan flooding', description: 'Manhattan flooding', status: 'active',
    createdBy: admin._id, location: { source: 'unresolved' },
  });
  // Prime the cache with one old report.
  await Report.create({
    disaster: disaster._id, externalId: 'legacy-1',
    source: 'mock-social', content: 'old report', author: 'legacy_user',
    priority: 'normal', externalCreatedAt: new Date(Date.now() - 60_000),
    fetchedAt: new Date(Date.now() - 60 * 60_000),
  });

  fetchReports.mockRejectedValueOnce(new Error('boom'));

  const { data, meta } = await getReportsForDisaster(disaster.toObject(), { limit: 10 });
  expect(meta.degraded).toBe(true);
  expect(meta.freshness).toBe('stale-fallback');
  expect(data).toHaveLength(1);
});

test('502 when provider fails and cache is empty', async () => {
  const admin = await User.create({
    username: 'admin2', role: 'admin',
    passwordHash: await User.hashPassword('x'),
  });
  const disaster = await Disaster.create({
    title: 'Empty cache test', description: 'somewhere', status: 'active',
    createdBy: admin._id, location: { source: 'unresolved' },
  });
  fetchReports.mockRejectedValueOnce(new Error('down'));

  await expect(getReportsForDisaster(disaster.toObject(), { limit: 10 })).rejects.toMatchObject({
    status: 502, code: 'BAD_GATEWAY',
  });
});
