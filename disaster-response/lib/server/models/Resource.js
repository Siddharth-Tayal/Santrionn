'use strict';

const mongoose = require('mongoose');
const { RESOURCE_TYPES } = require('../constants');

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2 &&
          v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90,
        message: 'coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 200, default: null },
    source: { type: String, enum: ['seeded', 'provided', 'resolved'], default: 'provided' },
    provider: { type: String, trim: true, maxlength: 40, default: null },
    point: { type: pointSchema, required: true },
  },
  { _id: false }
);

const resourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    type: { type: String, enum: RESOURCE_TYPES, required: true, index: true },
    location: { type: locationSchema, required: true },
    capacity: { type: Number, min: 0, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        if (ret.location?.point) {
          const [lng, lat] = ret.location.point.coordinates || [];
          ret.location.latitude = lat;
          ret.location.longitude = lng;
        }
        if (ret.location) delete ret.location.point;
        return ret;
      },
    },
  }
);

resourceSchema.index({ 'location.point': '2dsphere' });
resourceSchema.index({ type: 1, 'location.point': '2dsphere' });
resourceSchema.index({ name: 'text' }, { name: 'resource_search' });
resourceSchema.index({ name: 1, type: 1 }, { unique: true, name: 'resource_natural_key' });

module.exports = mongoose.models.Resource || mongoose.model('Resource', resourceSchema);
