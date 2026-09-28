'use strict';

const mongoose = require('mongoose');
const { DISASTER_STATUSES } = require('../constants');

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
    query: { type: String, trim: true, maxlength: 200, default: null },
    source: {
      type: String,
      enum: ['resolved', 'provided', 'unresolved', 'seeded'],
      default: 'unresolved',
    },
    provider: { type: String, trim: true, maxlength: 40, default: null },
    point: { type: pointSchema, default: undefined },
  },
  { _id: false }
);

const disasterSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 3, maxlength: 2000 },
    tags: { type: [String], default: [], index: true },
    status: { type: String, enum: DISASTER_STATUSES, required: true, default: 'active', index: true },
    location: { type: locationSchema, default: () => ({ source: 'unresolved' }) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

disasterSchema.pre('validate', function (next) {
  if (Array.isArray(this.tags)) {
    const seen = new Set();
    this.tags = this.tags
      .map((t) => String(t || '').trim().toLowerCase())
      .filter((t) => t && !seen.has(t) && seen.add(t))
      .slice(0, 10);
  }
  next();
});

disasterSchema.index({ 'location.point': '2dsphere' });
disasterSchema.index({ status: 1, createdAt: -1 });
disasterSchema.index({ title: 'text', description: 'text' }, { name: 'disaster_search' });

module.exports = mongoose.models.Disaster || mongoose.model('Disaster', disasterSchema);
