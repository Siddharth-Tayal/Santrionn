'use strict';

module.exports = Object.freeze({
  USER_ROLES: ['admin', 'contributor'],
  DISASTER_STATUSES: ['active', 'monitoring', 'resolved'],
  RESOURCE_TYPES: ['shelter', 'hospital', 'food', 'water', 'rescue'],
  REPORT_PRIORITIES: ['low', 'normal', 'high'],
  EVENTS: {
    DISASTER_CREATED: 'disaster.created',
    DISASTER_UPDATED: 'disaster.updated',
    DISASTER_DELETED: 'disaster.deleted',
    RESOURCE_CREATED: 'resource.created',
    RESOURCE_UPDATED: 'resource.updated',
    RESOURCE_DELETED: 'resource.deleted',
  },
  GEO: {
    EARTH_RADIUS_KM: 6371,
    MAX_RADIUS_KM: 200,
    MIN_RADIUS_KM: 0.1,
    DEFAULT_RADIUS_KM: 10,
  },
});
