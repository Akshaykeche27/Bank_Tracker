const express = require('express');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');

const router = express.Router();
const STATUSES = ['New', 'Interested', 'Follow-up', 'Converted', 'Not Interested'];
const OUTCOMES = ['Interested', 'Call Back', 'No Answer', 'Not Interested', 'Converted', 'Other'];
const FOLLOW_UP_TYPES = ['Call', 'Visit', 'Other'];

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The app is intended for an India-based banking workday. Using an explicit
// timezone keeps date filters correct even when the server is hosted in UTC.
function indiaDayBounds(dateString) {
  const day = dateString || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = new Date(`${day}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function validObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function handleError(res, error) {
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((item) => item.message).join(' ');
    return res.status(400).json({ message });
  }
  if (error.code === 11000) return res.status(409).json({ message: 'This record already exists.' });
  console.error(error);
  return res.status(500).json({ message: 'Server error. Please try again.' });
}

// Dashboard counters and today's work list.
router.get('/dashboard', async (_req, res) => {
  try {
    const bounds = indiaDayBounds();
    const [totalLeads, interestedLeads, todayFollowUps, overdueFollowUps, dueToday] = await Promise.all([
      Lead.countDocuments({ status: { $nin: ['Converted', 'Not Interested'] } }),
      Lead.countDocuments({ status: 'Interested' }),
      FollowUp.countDocuments({ status: 'Pending', dueAt: { $gte: bounds.start, $lt: bounds.end } }),
      FollowUp.countDocuments({ status: 'Pending', dueAt: { $lt: bounds.start } }),
      FollowUp.find({ status: 'Pending', dueAt: { $gte: bounds.start, $lt: bounds.end } })
        .populate('lead', 'name phone purpose requirementAmount location status')
        .sort({ dueAt: 1 })
        .limit(8),
    ]);
    res.json({
      stats: { totalLeads, interestedLeads, todayFollowUps, overdueFollowUps },
      dueToday,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// Searchable lead register.
router.get('/leads', async (req, res) => {
  try {
    const filter = {};
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();
    if (status && STATUSES.includes(status)) filter.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { purpose: { $regex: escaped, $options: 'i' } },
        { location: { $regex: escaped, $options: 'i' } },
      ];
    }
    const leads = await Lead.find(filter).sort({ updatedAt: -1 }).limit(300).lean();
    res.json({ leads });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/leads', async (req, res) => {
  try {
    const { name, phone, location, purpose, requirementAmount, source, status, initialRemark, nextFollowUpAt, nextFollowUpType } = req.body;
    const lead = await Lead.create({
      name, phone, location, purpose,
      requirementAmount: requirementAmount === '' || requirementAmount == null ? 0 : Number(requirementAmount),
      source: source || 'DB Calling',
      status: nextFollowUpAt ? (status === 'Interested' ? 'Interested' : 'Follow-up') : (status || 'New'),
      lastContactAt: new Date(),
      lastRemark: initialRemark || '',
    });

    let followUp = null;
    if (nextFollowUpAt) {
      const dueAt = parseDate(nextFollowUpAt);
      if (!dueAt || dueAt <= new Date()) {
        await Lead.findByIdAndDelete(lead._id);
        return res.status(400).json({ message: 'Choose a follow-up date and time in the future.' });
      }
      followUp = await FollowUp.create({
        lead: lead._id,
        dueAt,
        type: FOLLOW_UP_TYPES.includes(nextFollowUpType) ? nextFollowUpType : 'Call',
        remark: initialRemark || '',
      });
    }
    res.status(201).json({ message: 'Lead saved successfully.', lead, followUp });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/leads/:id', async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid lead ID.' });
    const lead = await Lead.findById(req.params.id).lean();
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    const followUps = await FollowUp.find({ lead: lead._id }).sort({ dueAt: -1 }).limit(30).lean();
    res.json({ lead, followUps });
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/leads/:id', async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid lead ID.' });
    const allowed = ['name', 'phone', 'location', 'purpose', 'requirementAmount', 'source', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = key === 'requirementAmount' ? Number(req.body[key]) : req.body[key];
    }
    const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    res.json({ message: 'Lead updated.', lead });
  } catch (error) {
    handleError(res, error);
  }
});

// Follow-up register with date-aware filters.
router.get('/follow-ups', async (req, res) => {
  try {
    const filterName = String(req.query.filter || 'today');
    const date = String(req.query.date || '');
    const bounds = indiaDayBounds(date || undefined);
    if (!bounds) return res.status(400).json({ message: 'Date must be in YYYY-MM-DD format.' });

    const query = {};
    if (filterName === 'today') {
      query.status = 'Pending';
      query.dueAt = { $gte: bounds.start, $lt: bounds.end };
    } else if (filterName === 'overdue') {
      query.status = 'Pending';
      query.dueAt = { $lt: indiaDayBounds().start };
    } else if (filterName === 'upcoming') {
      query.status = 'Pending';
      query.dueAt = { $gte: indiaDayBounds().end };
    } else if (filterName === 'completed') {
      query.status = 'Completed';
    } else {
      query.status = 'Pending';
    }

    const followUps = await FollowUp.find(query)
      .populate('lead', 'name phone purpose requirementAmount location status')
      .sort({ dueAt: filterName === 'overdue' ? 1 : 1 })
      .limit(300)
      .lean();
    res.json({ followUps });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/leads/:id/follow-ups', async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid lead ID.' });
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    const dueAt = parseDate(req.body.dueAt);
    if (!dueAt || dueAt <= new Date()) return res.status(400).json({ message: 'Choose a follow-up date and time in the future.' });
    const followUp = await FollowUp.create({
      lead: lead._id,
      dueAt,
      type: FOLLOW_UP_TYPES.includes(req.body.type) ? req.body.type : 'Call',
      remark: req.body.remark || '',
    });
    if (!['Converted', 'Not Interested'].includes(lead.status)) lead.status = 'Follow-up';
    await lead.save();
    res.status(201).json({ message: 'Follow-up scheduled.', followUp });
  } catch (error) {
    handleError(res, error);
  }
});

// Complete a due item, save the result, and optionally schedule the next touch.
router.post('/follow-ups/:id/complete', async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid follow-up ID.' });
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) return res.status(404).json({ message: 'Follow-up not found.' });
    if (followUp.status !== 'Pending') return res.status(400).json({ message: 'This follow-up is already closed.' });

    const nextDate = req.body.nextFollowUpAt ? parseDate(req.body.nextFollowUpAt) : null;
    if (req.body.nextFollowUpAt && (!nextDate || nextDate <= new Date())) {
      return res.status(400).json({ message: 'The next follow-up must be in the future.' });
    }
    const outcome = OUTCOMES.includes(req.body.outcome) ? req.body.outcome : 'Other';
    const remark = String(req.body.remark || '').trim();
    followUp.status = 'Completed';
    followUp.outcome = outcome;
    followUp.remark = remark;
    followUp.completedAt = new Date();
    await followUp.save();

    const lead = await Lead.findById(followUp.lead);
    if (!lead) return res.status(404).json({ message: 'Related lead not found.' });
    lead.lastContactAt = new Date();
    lead.lastRemark = remark;
    if (outcome === 'Interested' || outcome === 'Call Back') lead.status = 'Follow-up';
    if (outcome === 'No Answer' || outcome === 'Other') {
      if (!['Converted', 'Not Interested'].includes(lead.status)) lead.status = 'Follow-up';
    }
    if (outcome === 'Not Interested') lead.status = 'Not Interested';
    if (outcome === 'Converted') lead.status = 'Converted';
    await lead.save();

    let nextFollowUp = null;
    if (nextDate) {
      if (!['Converted', 'Not Interested'].includes(lead.status)) {
        nextFollowUp = await FollowUp.create({
          lead: lead._id,
          dueAt: nextDate,
          type: FOLLOW_UP_TYPES.includes(req.body.nextFollowUpType) ? req.body.nextFollowUpType : 'Call',
          remark: 'Next follow-up',
        });
        lead.status = 'Follow-up';
        await lead.save();
      }
    }

    res.json({ message: 'Follow-up updated.', followUp, nextFollowUp, lead });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
