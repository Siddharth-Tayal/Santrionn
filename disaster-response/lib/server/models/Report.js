'use strict';

const mongoose = require('mongoose');
const config = require('../config/env');
const { REPORT_PRIORITIES } = require('../constants');

const reportSchema = new mongoose.Schema(
  {
    disaster: { type: mongoose.Schema.Types.ObjectId, ref: 'Disaster', required: true, index: true },
    externalId: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true, maxlength: 40, default: 'mock-social' },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    author: { type: String, required: true, trim: true, maxlength: 80 },
    priority: { type: String, enum: REPORT_PRIORITIES, required: true, default: 'normal' },
    externalCreatedAt: { type: Date, required: true },
    fetchedAt: { type: Date, required: true, default: Date.now },
  },
  {
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        ret.disaster = ret.disaster && ret.disaster._id ? String(ret.disaster._id) : ret.disaster;
        return ret;
      },
    },
  }
);

reportSchema.index({ disaster: 1, externalId: 1 }, { unique: true, name: 'disaster_external_unique' });
reportSchema.index({ disaster: 1, priority: -1, externalCreatedAt: -1 });
reportSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: config.REPORTS_TTL_SECONDS, name: 'report_ttl' });

module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
