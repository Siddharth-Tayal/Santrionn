'use strict';

const { z } = require('zod');
const { strictObject, objectId, latitude, longitude, paginationQuery } = require('./common.schema');
const { RESOURCE_TYPES } = require('../constants');

const nearbyQuery = strictObject({
  radius: z.coerce.number().positive().max(200).optional(),
  type: z.enum(RESOURCE_TYPES).optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
}).refine(
  (v) => (v.lat === undefined && v.lng === undefined) || (v.lat !== undefined && v.lng !== undefined),
  { message: 'lat and lng must be provided together' }
);

const listResourcesQuery = strictObject({
  type: z.enum(RESOURCE_TYPES).optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
  radius: z.coerce.number().positive().max(200).optional(),
  ...paginationQuery,
}).refine(
  (v) => (v.lat === undefined && v.lng === undefined) || (v.lat !== undefined && v.lng !== undefined),
  { message: 'lat and lng must be provided together' }
);

const disasterIdParams = strictObject({ id: objectId });

module.exports = { nearbyQuery, listResourcesQuery, disasterIdParams };
