'use strict';

const { z } = require('zod');
const { strictObject, objectId, optionalCoordinatePair, paginationQuery } = require('./common.schema');
const { DISASTER_STATUSES } = require('../constants');

const tags = z
  .array(z.string().trim().min(1).max(40))
  .max(10)
  .optional();

const createDisasterBody = strictObject({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(2000),
  tags,
  status: z.enum(DISASTER_STATUSES).default('active'),
  location: optionalCoordinatePair,
});

const updateDisasterBody = strictObject({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(3).max(2000).optional(),
  tags,
  status: z.enum(DISASTER_STATUSES).optional(),
  location: optionalCoordinatePair,
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

const listDisastersQuery = strictObject({
  status: z.enum(DISASTER_STATUSES).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(['recent', 'oldest', 'status']).default('recent'),
  ...paginationQuery,
});

const disasterParams = strictObject({ id: objectId });

module.exports = {
  createDisasterBody,
  updateDisasterBody,
  listDisastersQuery,
  disasterParams,
};
