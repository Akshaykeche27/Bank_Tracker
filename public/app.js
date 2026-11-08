const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  activeView: 'dashboard',
  followupFilter: 'today',
  activeLeadId: null,
  activeFollowUpId: null,
  leads: [],
  toastTimer: null,
};

const money = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Not specified';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localInputValue(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISOFromLocal(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', options).format(date);
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function timeLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const today = localDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateString = localDateString(date);
  if (dateString === today) return `Today, ${formatTime(value)}`;
  if (dateString === localDateString(tomorrow)) return `Tomorrow, ${formatTime(value)}`;
  return `${formatDate(value, { day: '2-digit', month: 'short' })}, ${formatTime(value)}`;
}

function initials(name = '') {
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'L';
}

function statusClass(status = '') {
  return `status-${String(status).toLowerCase().replace(/[^a-z]+/g, '-')}`;
}

async function api(url, options = {}) {
  const config = { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } };
  const response = await fetch(url, config);
  let data;
  try { data = await response.json(); } catch (_error) { data = {}; }
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const focusable = $('input, select, textarea, button', modal);
  if (focusable) setTimeout(() => focusable.focus(), 30);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (!$('.modal-backdrop.open')) document.body.style.overflow = '';
}

function setView(view) {
  state.activeView = view;
  $$('.view').forEach((section) => section.classList.toggle('active', section.id === `${view}View`));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  const labels = { dashboard: 'Dashboard', leads: 'Lead register', followups: 'Follow-ups' };
  $('#pageName').textContent = labels[view] || 'Dashboard';
  if (view === 'dashboard') loadDashboard();
  if (view === 'leads') loadLeads();
  if (view === 'followups') loadFollowups();
}

function renderDashboardFollowups(items) {
  const container = $('#dashboardFollowups');
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><strong>You're clear for now</strong><p>No pending follow-ups scheduled for today. Add a lead or check your upcoming callbacks.</p></div>`;
    return;
  }
  container.innerHTML = items.map((item) => {
    const lead = item.lead || {};
    const purpose = lead.purpose || 'Customer follow-up';
    return `<div class="compact-item">
      <div class="time-box">${escapeHTML(formatTime(item.dueAt))}</div>
      <div class="compact-info"><strong>${escapeHTML(lead.name || 'Unknown customer')}</strong><small>${escapeHTML(purpose)} · ${escapeHTML(item.type || 'Call')}</small><span class="compact-amount">${escapeHTML(money(lead.requirementAmount))}</span></div>
      <button class="mini-action" data-complete-id="${escapeHTML(item._id)}" data-customer="${escapeHTML(lead.name || '')}" type="button">Log result</button>
    </div>`;
  }).join('');
}

async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    $('#statToday').textContent = data.stats.todayFollowUps;
    $('#statOverdue').textContent = data.stats.overdueFollowUps;
    $('#statLeads').textContent = data.stats.totalLeads;
    $('#statInterested').textContent = data.stats.interestedLeads;
    $('#navLeadCount').textContent = data.stats.totalLeads;
    $('#navDueCount').textContent = data.stats.todayFollowUps + data.stats.overdueFollowUps;
    $('#todayTabCount').textContent = data.stats.todayFollowUps;
    $('#overdueTabCount').textContent = data.stats.overdueFollowUps;
    renderDashboardFollowups(data.dueToday);
  } catch (error) {
    $('#dashboardFollowups').innerHTML = `<div class="empty-state"><strong>Could not load your dashboard</strong><p>${escapeHTML(error.message)} Check that the server and MongoDB are running.</p></div>`;
    showToast(error.message, true);
  }
}

function renderLeads(leads) {
  const tbody = $('#leadTableBody');
  $('#leadResultCount').textContent = leads.length;
  $('#leadTableFooter').textContent = `${leads.length} lead${leads.length === 1 ? '' : 's'} shown`;
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">▤</div><strong>No leads found</strong><p>Try another search or add your first customer lead.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = leads.map((lead) => `
    <tr>
      <td><div class="customer-cell"><span class="avatar">${escapeHTML(initials(lead.name))}</span><span><span class="customer-name">${escapeHTML(lead.name)}</span><span class="customer-phone">${escapeHTML(lead.phone)}</span></span></div></td>
      <td><span class="purpose-main">${escapeHTML(lead.purpose)}</span><span class="purpose-sub">${escapeHTML(money(lead.requirementAmount))}${lead.location ? ` · ${escapeHTML(lead.location)}` : ''}</span></td>
      <td>${escapeHTML(lead.source || 'DB Calling')}</td>
      <td><span class="status-pill ${statusClass(lead.status)}">${escapeHTML(lead.status)}</span></td>
      <td>${escapeHTML(lead.lastRemark || '—')}</td>
      <td><button class="row-link" data-open-lead="${escapeHTML(lead._id)}" type="button" aria-label="Open ${escapeHTML(lead.name)} details">›</button></td>
    </tr>`).join('');
}

let leadSearchTimer;
async function loadLeads() {
  const search = $('#leadSearch').value.trim();
  const status = $('#leadStatusFilter').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  $('#leadTableBody').innerHTML = '<tr><td colspan="6" class="loading-state">Loading leads…</td></tr>';
  try {
    const data = await api(`/api/leads?${params.toString()}`);
    state.leads = data.leads;
    renderLeads(data.leads);
  } catch (error) {
    $('#leadTableBody').innerHTML = `<tr><td colspan="6" class="loading-state">${escapeHTML(error.message)}</td></tr>`;
  }
}

function renderFollowups(items) {
  const container = $('#followupList');
  $('#followupListCount').textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  if (!items.length) {
    const messages = {
      today: ['No follow-ups for this date', 'There are no pending callbacks scheduled for the selected day.'],
      overdue: ['No overdue callbacks', 'Great — there are no pending follow-ups from previous days.'],
      upcoming: ['No upcoming callbacks', 'No future follow-ups are scheduled yet.'],
      completed: ['No completed follow-ups yet', 'Completed customer conversations will appear here.'],
      all: ['No pending follow-ups', 'Schedule a callback from a lead profile to see it here.'],
    };
    const message = messages[state.followupFilter] || messages.today;
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><strong>${message[0]}</strong><p>${message[1]}</p></div>`;
    return;
  }
  const isCompleted = state.followupFilter === 'completed';
  container.innerHTML = items.map((item) => {
    const lead = item.lead || {};
    const dueDate = item.dueAt ? new Date(item.dueAt) : new Date();
    const overdue = !isCompleted && dueDate.getTime() < Date.now();
    const dateMain = isCompleted ? formatDate(item.completedAt || item.updatedAt, { day: '2-digit', month: 'short' }) : formatDate(item.dueAt, { day: '2-digit', month: 'short' });
    const dateSub = isCompleted ? 'Done' : formatTime(item.dueAt);
    const resultText = isCompleted ? (item.outcome || 'Completed') : (item.type || 'Call');
    const remark = item.remark || 'No remark added';
    return `<article class="followup-row">
      <div class="followup-datebox ${overdue ? 'overdue' : ''}"><strong>${escapeHTML(dateMain.split(' ')[0])}</strong><small>${escapeHTML(dateMain.split(' ').slice(1).join(' '))} · ${escapeHTML(dateSub)}</small></div>
      <div class="followup-main"><strong>${escapeHTML(lead.name || 'Unknown customer')}</strong><p>${escapeHTML(lead.purpose || 'Customer follow-up')} · ${escapeHTML(money(lead.requirementAmount))}</p><p class="followup-phone">${escapeHTML(lead.phone || '')}${lead.location ? ` · ${escapeHTML(lead.location)}` : ''}</p></div>
      <div class="followup-meta"><strong>${escapeHTML(resultText)}${overdue ? ' · Overdue' : ''}</strong><small>${escapeHTML(remark)}</small></div>
      <div class="followup-actions">${isCompleted ? `<span class="history-tag">✓ Completed</span>` : `<button class="complete-button" data-complete-id="${escapeHTML(item._id)}" data-customer="${escapeHTML(lead.name || '')}" type="button">Log result</button>`}</div>
    </article>`;
  }).join('');
}

async function loadFollowups() {
  const params = new URLSearchParams({ filter: state.followupFilter });
  if (state.followupFilter === 'today') params.set('date', $('#followupDate').value || localDateString());
  $('#followupList').innerHTML = '<div class="loading-state">Loading follow-ups…</div>';
  try {
    const data = await api(`/api/follow-ups?${params.toString()}`);
    renderFollowups(data.followUps);
  } catch (error) {
    $('#followupList').innerHTML = `<div class="empty-state"><strong>Could not load follow-ups</strong><p>${escapeHTML(error.message)}</p></div>`;
  }
}

function openNewLead() {
  $('#leadForm').reset();
  $('#leadFormMessage').textContent = '';
  openModal('leadModal');
}

async function openLeadDetails(id) {
  state.activeLeadId = id;
  $('#leadDetailsContent').innerHTML = '<div class="loading-state">Loading customer history…</div>';
  $('#detailTitle').textContent = 'Customer details';
  $('#detailSubtitle').textContent = '';
  openModal('detailModal');
  try {
    const data = await api(`/api/leads/${id}`);
    const lead = data.lead;
    $('#detailTitle').textContent = lead.name;
    $('#detailSubtitle').textContent = `${lead.phone}${lead.location ? ` · ${lead.location}` : ''}`;
    const followHistory = data.followUps.length ? data.followUps.map((item) => `
      <div class="history-item"><span class="history-bullet"></span><div><strong>${escapeHTML(item.status)} · ${escapeHTML(item.type)} · ${escapeHTML(formatDate(item.dueAt))} ${escapeHTML(formatTime(item.dueAt))}</strong><p>${escapeHTML(item.outcome || 'Scheduled')}${item.remark ? ` — ${escapeHTML(item.remark)}` : ''}</p></div></div>`).join('') : '<p class="page-subtitle">No follow-up history yet.</p>';
    $('#leadDetailsContent').innerHTML = `
      <div class="detail-grid">
        <div class="detail-cell"><small>Purpose</small><strong>${escapeHTML(lead.purpose)}</strong></div>
        <div class="detail-cell"><small>Requirement</small><strong>${escapeHTML(money(lead.requirementAmount))}</strong></div>
        <div class="detail-cell"><small>Lead source</small><strong>${escapeHTML(lead.source)}</strong></div>
        <div class="detail-cell"><small>Current status</small><strong><span class="status-pill ${statusClass(lead.status)}">${escapeHTML(lead.status)}</span></strong></div>
        <div class="detail-cell"><small>Location</small><strong>${escapeHTML(lead.location || '—')}</strong></div>
        <div class="detail-cell"><small>Last contacted</small><strong>${escapeHTML(formatDate(lead.lastContactAt))}</strong></div>
      </div>
      <div class="detail-remark"><strong>Latest remark</strong><br />${escapeHTML(lead.lastRemark || 'No remark recorded yet.')}</div>
      <div class="history-heading">CONTACT & FOLLOW-UP HISTORY</div>
      <div>${followHistory}</div>`;
  } catch (error) {
    $('#leadDetailsContent').innerHTML = `<div class="empty-state"><strong>Could not load lead</strong><p>${escapeHTML(error.message)}</p></div>`;
  }
}

function openScheduleModal(leadId, leadName = '') {
  state.activeLeadId = leadId;
  $('#scheduleForm').reset();
  $('#scheduleMessage').textContent = '';
  $('#scheduleSubtitle').textContent = leadName ? `Set the next contact for ${leadName}.` : 'Choose a date and time.';
  closeModal('detailModal');
  openModal('scheduleModal');
}

function openCompleteModal(id, customer = '') {
  state.activeFollowUpId = id;
  $('#completeForm').reset();
  $('#completeMessage').textContent = '';
  $('#completeSubtitle').textContent = customer ? `Record the result of your follow-up with ${customer}.` : 'Record what happened on the call.';
  openModal('completeModal');
}

// Event wiring
$$('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$('#openNewLead').addEventListener('click', openNewLead);
$('#quickAddLead').addEventListener('click', openNewLead);
$('#leadPageNew').addEventListener('click', openNewLead);

$$('[data-go-followups]').forEach((button) => button.addEventListener('click', () => {
  state.followupFilter = button.dataset.goFollowups;
  updateFollowupTabs();
  setView('followups');
}));
$$('[data-go-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.goView)));
$$('[data-stat-filter]').forEach((button) => button.addEventListener('click', () => {
  const filter = button.dataset.statFilter;
  if (filter === 'leads-interested') {
    $('#leadStatusFilter').value = 'Interested';
    $('#leadSearch').value = '';
    setView('leads');
  } else if (filter === 'all') {
    $('#leadStatusFilter').value = '';
    $('#leadSearch').value = '';
    setView('leads');
  } else {
    state.followupFilter = filter;
    updateFollowupTabs();
    setView('followups');
  }
}));

function updateFollowupTabs() {
  $$('.filter-tab').forEach((tab) => {
    const active = tab.dataset.filter === state.followupFilter;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

$$('.filter-tab').forEach((button) => button.addEventListener('click', () => {
  state.followupFilter = button.dataset.filter;
  updateFollowupTabs();
  loadFollowups();
}));

$('#followupDate').addEventListener('change', () => {
  if (state.followupFilter !== 'today') {
    state.followupFilter = 'today';
    updateFollowupTabs();
  }
  loadFollowups();
});

$('#leadSearch').addEventListener('input', () => {
  clearTimeout(leadSearchTimer);
  leadSearchTimer = setTimeout(loadLeads, 260);
});
$('#leadStatusFilter').addEventListener('change', loadLeads);
$('#globalSearch').addEventListener('input', (event) => {
  $('#leadSearch').value = event.target.value;
  if (state.activeView !== 'leads') setView('leads');
  else {
    clearTimeout(leadSearchTimer);
    leadSearchTimer = setTimeout(loadLeads, 260);
  }
});

$('#leadForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  values.requirementAmount = values.requirementAmount === '' ? 0 : Number(values.requirementAmount);
  if (values.nextFollowUpAt) values.nextFollowUpAt = toISOFromLocal(values.nextFollowUpAt);
  else delete values.nextFollowUpAt;
  const button = $('#saveLeadButton');
  button.disabled = true;
  button.textContent = 'Saving…';
  $('#leadFormMessage').textContent = '';
  try {
    await api('/api/leads', { method: 'POST', body: JSON.stringify(values) });
    closeModal('leadModal');
    showToast('Lead saved successfully.');
    form.reset();
    await Promise.all([loadDashboard(), state.activeView === 'leads' ? loadLeads() : Promise.resolve()]);
  } catch (error) {
    $('#leadFormMessage').textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Save lead <span>→</span>';
  }
});

$('#detailScheduleButton').addEventListener('click', () => {
  const name = $('#detailTitle').textContent;
  openScheduleModal(state.activeLeadId, name);
});

$('#scheduleForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  values.dueAt = toISOFromLocal(values.dueAt);
  try {
    await api(`/api/leads/${state.activeLeadId}/follow-ups`, { method: 'POST', body: JSON.stringify(values) });
    closeModal('scheduleModal');
    showToast('Follow-up scheduled.');
    await Promise.all([loadDashboard(), state.activeView === 'followups' ? loadFollowups() : Promise.resolve(), state.activeView === 'leads' ? loadLeads() : Promise.resolve()]);
  } catch (error) {
    $('#scheduleMessage').textContent = error.message;
  }
});

$('#completeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  if (values.nextFollowUpAt) values.nextFollowUpAt = toISOFromLocal(values.nextFollowUpAt);
  else delete values.nextFollowUpAt;
  try {
    await api(`/api/follow-ups/${state.activeFollowUpId}/complete`, { method: 'POST', body: JSON.stringify(values) });
    closeModal('completeModal');
    showToast('Follow-up result saved.');
    await Promise.all([loadDashboard(), state.activeView === 'followups' ? loadFollowups() : Promise.resolve(), state.activeView === 'leads' ? loadLeads() : Promise.resolve()]);
  } catch (error) {
    $('#completeMessage').textContent = error.message;
  }
});

// Delegated actions for dynamically rendered rows.
document.addEventListener('click', (event) => {
  const leadButton = event.target.closest('[data-open-lead]');
  if (leadButton) openLeadDetails(leadButton.dataset.openLead);
  const completeButton = event.target.closest('[data-complete-id]');
  if (completeButton) openCompleteModal(completeButton.dataset.completeId, completeButton.dataset.customer || '');
});

$$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
$$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => {
  if (event.target === backdrop) closeModal(backdrop.id);
}));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') $$('.modal-backdrop.open').forEach((modal) => closeModal(modal.id));
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('#globalSearch').focus();
  }
});

// Initial state
const today = new Date();
$('#todayDate').textContent = formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
$('#todayLabel').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(today).toUpperCase() + ' OVERVIEW';
const hour = today.getHours();
$('h1').firstChild.textContent = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
$('#followupDate').value = localDateString();
setView('dashboard');
