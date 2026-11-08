const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required.'],
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required.'],
      trim: true,
      maxlength: 20,
    },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    purpose: {
      type: String,
      required: [true, 'Purpose is required.'],
      trim: true,
      maxlength: 120,
    },
    requirementAmount: {
      type: Number,
      min: [0, 'Requirement amount cannot be negative.'],
      default: 0,
    },
    source: {
      type: String,
      enum: ['DB Calling', 'Visit', 'Reference', 'Other'],
      default: 'DB Calling',
    },
    status: {
      type: String,
      enum: ['New', 'Interested', 'Follow-up', 'Converted', 'Not Interested'],
      default: 'New',
    },
    lastContactAt: { type: Date, default: null },
    lastRemark: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

leadSchema.index({ name: 'text', phone: 'text', purpose: 'text', location: 'text' });
leadSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
