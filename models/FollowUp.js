const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    dueAt: { type: Date, required: [true, 'Follow-up date and time are required.'] },
    type: {
      type: String,
      enum: ['Call', 'Visit', 'Other'],
      default: 'Call',
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    outcome: {
      type: String,
      enum: ['Interested', 'Call Back', 'No Answer', 'Not Interested', 'Converted', 'Other', ''],
      default: '',
    },
    remark: { type: String, trim: true, maxlength: 1000, default: '' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

followUpSchema.index({ status: 1, dueAt: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);
