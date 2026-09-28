'use strict';

/**
 * These tests exercise the disaster service and its validation contract
 * directly. Route handlers are thin wrappers over these calls, so a test
 * against the service is equivalent to one against the endpoint — with the
 * benefit that we can run it in a plain CJS test file.
 */

const { connectDatabase, disconnectDatabase, syncIndexes } = require('../../lib/server/db');
const User = require('../../lib/server/models/User');
const Disaster = require('../../lib/server/models/Disaster');
const {
  createDisaster,
  updateDisaster,
  nearbyResources,
} = require('../../lib/server/services/disasters.service');
const { createDisasterBody } = require('../../lib/server/validation/disaster.schema');
const { loginBody } = require('../../lib/server/validation/auth.schema');

beforeAll(async () => { await connectDatabase(); await syncIndexes(); });
afterAll(async () => { await disconnectDatabase(); });
afterEach(async () => {
  await Disaster.deleteMany({});
  await User.deleteMany({});
});

async function makeUser(role = 'admin', username = role) {
  const passwordHash = await User.hashPassword('Password@123');
  return User.create({ username, displayName: `${role} user`, role, passwordHash });
}

describe('createDisaster', () => {
  test('creates a disaster and resolves location from description', async () => {
    const admin = await makeUser('admin');
    const disaster = await createDisaster({
      title: 'Flooding in Manhattan',
      description: 'Heavy flooding has affected Manhattan, NYC.',
      tags: ['flood', 'urban'],
      status: 'active',
    }, { userId: admin._id, role: admin.role });

    expect(disaster.title).toBe('Flooding in Manhattan');
    expect(disaster.location.source).toBe('resolved');
    expect(disaster.location.latitude).toBeCloseTo(40.7128, 1);
    expect(disaster.createdByUser.username).toBe('admin');
  });

  test('validation rejects mass-assignment on unknown key', () => {
    const parsed = createDisasterBody.safeParse({
      title: 'Manhattan flood',
      description: 'Manhattan',
      createdBy: '000000000000000000000000',
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].code).toBe('unrecognized_keys');
  });

  test('validation rejects NoSQL operator injection on login body', () => {
    const parsed = loginBody.safeParse({ username: { $ne: null }, password: { $ne: null } });
    expect(parsed.success).toBe(false);
  });
});

describe('updateDisaster — business rule: reopen is admin-only', () => {
  test('contributor cannot mark a resolved incident active', async () => {
    const admin = await makeUser('admin', 'admin1');
    const contributor = await makeUser('contributor', 'contrib1');
    const disaster = await Disaster.create({
      title: 'Resolved event',
      description: 'Manhattan flooding',
      status: 'resolved',
      createdBy: admin._id,
      location: { source: 'unresolved' },
    });

    await expect(
      updateDisaster(String(disaster._id), { status: 'active' },
        { userId: contributor._id, role: contributor.role })
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  test('admin can reopen', async () => {
    const admin = await makeUser('admin');
    const disaster = await Disaster.create({
      title: 'Resolved event',
      description: 'Manhattan flooding',
      status: 'resolved',
      createdBy: admin._id,
      location: { source: 'unresolved' },
    });
    const updated = await updateDisaster(String(disaster._id), { status: 'active' },
      { userId: admin._id, role: admin.role });
    expect(updated.status).toBe('active');
  });
});

describe('nearbyResources', () => {
  test('rejects when disaster has no coordinates and no lat/lng provided', async () => {
    const admin = await makeUser('admin');
    const disaster = await Disaster.create({
      title: 'A disaster',
      description: 'No place named',
      status: 'active',
      createdBy: admin._id,
      location: { source: 'unresolved' },
    });
    await expect(
      nearbyResources(String(disaster._id), { radius: 10 })
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' });
  });
});
