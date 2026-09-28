'use strict';

const { z } = require('zod');

/** Reject unknown keys everywhere — mass-assignment protection. */
function strictObject(shape) {
  return z.object(shape).strict();
}

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'must be a 24-character hex id');

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

const optionalCoordinatePair = strictObject({
  latitude,
  longitude,
})
  .strict()
  .optional();

const paginationQuery = {
  page: z.coerce.number().int().positive().max(10000).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
};

module.exports = {
  strictObject,
  objectId,
  latitude,
  longitude,
  optionalCoordinatePair,
  paginationQuery,
};
