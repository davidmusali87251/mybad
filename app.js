const STORAGE_KEY = 'mistake-tracker-entries';

let entries = [];
let currentPeriod = 'day';

const CONFIG = (typeof window !== 'undefined' && window.MISTAKE_TRACKER_CONFIG) || {};
const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (CONFIG.SUPABASE_ANON_KEY || '').trim();
const SHARING_ENABLED = SUPABASE_URL && SUPABASE_ANON_KEY;

const addNoteInput = document.getElementById('mistake-note');
const addBtn = document.getElementById('add-mistake');
const typeInputs = document.querySelectorAll('input[name="mistake-type"]');
const periodTabs = document.querySelectorAll('.tab');
const statCount = document.getElementById('stat-count');
const statLabel = document.getElementById('stat-label');
const statAvg = document.getElementById('stat-avg');
const entryList = document.getElementById('entry-list');
const emptyState = document.getElementById('empty-state');
const statsNote = document.getElementById('stats-note');
const shareSection = document.getElementById('share-section');
const btnShare = document.getElementById('btn-share');
const shareStatus = document.getElementById('share-status');
const sharedList = document.getElementById('shared-list');
const sharedEmpty = document.getElementById('shared-empty');
const btnRefreshFeed = document.getElementById('btn-refresh-feed');
const communityError = document.getElementById('community-error');
const communitySection = document.getElementById('community-section');

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    entries = [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function getStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function getStartOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function getStartOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function filterByPeriod(period) {
  const now = Date.now();
  let start;
  if (period === 'day') start = getStartOfDay(now);
  else if (period === 'week') start = getStartOfWeek(now);
  else start = getStartOfMonth(now);
  return entries.filter(e => e.at >= start);
}

function getDaysInPeriod(period) {
  const now = new Date();
  if (period === 'day') return 1;
  if (period === 'week') return 7;
  const dayOfMonth = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(dayOfMonth, lastDay);
}

function getPeriodLabel(period) {
  if (period === 'day') return 'mistakes today';
  if (period === 'week') return 'mistakes this week';
  return 'mistakes this month';
}

function renderStats() {
  const filtered = filterByPeriod(currentPeriod);
  const count = filtered.length;
  const days = getDaysInPeriod(currentPeriod);
  const avg = days > 0 ? (count / days).toFixed(1) : '—';

  const avoidableCount = filtered.filter(e => (e.type || 'avoidable') === 'avoidable').length;
  const fertileCount = filtered.filter(e => (e.type || 'avoidable') === 'fertile').length;

  statCount.textContent = count;
  statLabel.textContent = getPeriodLabel(currentPeriod);
  statAvg.textContent = avg;

  if (statsNote) {
    if (count === 0) {
      statsNote.textContent = "No mistakes logged this period. That's okay—just check that you're still exploring and learning.";
    } else {
      statsNote.textContent =
        avoidableCount + " avoidable (aim to reduce) · " +
        fertileCount + " fertile (valuable experiments)";
    }
  }
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = getStartOfDay(now);
  const entryDay = getStartOfDay(ts);
  if (entryDay === today) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (entryDay >= today - 86400000 * 6) {
    return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderList() {
  const filtered = filterByPeriod(currentPeriod);
  entryList.innerHTML = '';

  const sorted = [...filtered].sort((a, b) => b.at - a.at);
  const show = sorted.slice(0, 30);

  show.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'entry-item';
    const badge = document.createElement('span');
    const type = entry.type || 'avoidable';
    badge.className = 'badge ' + (type === 'fertile' ? 'badge-fertile' : 'badge-avoidable');
    badge.textContent = type === 'fertile' ? 'FERTILE' : 'AVOIDABLE';
    const note = document.createElement('span');
    note.className = 'note' + (entry.note ? '' : ' empty');
    note.textContent = entry.note || '(no note)';
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(entry.at);
    li.appendChild(badge);
    li.appendChild(note);
    li.appendChild(time);
    entryList.appendChild(li);
  });

  emptyState.classList.toggle('hidden', show.length > 0);
}

function getSelectedType() {
  if (!typeInputs || typeInputs.length === 0) return 'avoidable';
  const checked = Array.from(typeInputs).find(i => i.checked);
  return (checked && checked.value) || 'avoidable';
}

function addMistake() {
  const note = (addNoteInput.value || '').trim();
  const type = getSelectedType();
  entries.push({ at: Date.now(), note, type });
  saveEntries();
  addNoteInput.value = '';
  renderStats();
  renderList();
}

function setPeriod(period) {
  currentPeriod = period;
  periodTabs.forEach(t => t.classList.toggle('active', t.dataset.period === period));
  renderStats();
  renderList();
}

// --- Anonymous sharing (Supabase) ---
function getSupabase() {
  if (!SHARING_ENABLED || typeof supabase === 'undefined') return null;
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getCurrentStatsForShare() {
  const filtered = filterByPeriod(currentPeriod);
  const count = filtered.length;
  const days = getDaysInPeriod(currentPeriod);
  const avg = days > 0 ? parseFloat((count / days).toFixed(1)) : null;
  return { period: currentPeriod, count, avg_per_day: avg };
}

async function shareAnonymously() {
  if (!SHARING_ENABLED) {
    shareStatus.textContent = 'Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js to enable sharing.';
    shareStatus.className = 'share-status error';
    return;
  }
  shareStatus.textContent = 'Sharing…';
  shareStatus.className = 'share-status';
  btnShare.disabled = true;
  const stats = getCurrentStatsForShare();
  const client = getSupabase();
  const { error } = await client.from('shared_stats').insert({
    period: stats.period,
    count: stats.count,
    avg_per_day: stats.avg_per_day
  });
  btnShare.disabled = false;
  if (error) {
    shareStatus.textContent = 'Failed: ' + (error.message || 'Unknown error');
    shareStatus.className = 'share-status error';
    return;
  }
  shareStatus.textContent = 'Shared anonymously.';
  shareStatus.className = 'share-status success';
  setTimeout(() => { shareStatus.textContent = ''; }, 3000);
  fetchSharedStats();
}

async function fetchSharedStats() {
  if (!SHARING_ENABLED) {
    showCommunitySetupMessage();
    return;
  }
  communityError.classList.add('hidden');
  communityError.textContent = '';
  const client = getSupabase();
  const { data, error } = await client
    .from('shared_stats')
    .select('id, period, count, avg_per_day, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    communityError.textContent = 'Could not load: ' + (error.message || 'Unknown error');
    communityError.classList.remove('hidden');
    sharedList.innerHTML = '';
    sharedEmpty.classList.remove('hidden');
    return;
  }
  sharedEmpty.classList.toggle('hidden', (data && data.length) > 0);
  if (!data || data.length === 0) {
    sharedList.innerHTML = '';
    sharedEmpty.textContent = "No shared results yet. Share yours above!";
    return;
  }
  sharedList.innerHTML = '';
  data.forEach(row => {
    const li = document.createElement('li');
    li.className = 'shared-item';
    const periodLabel = getPeriodLabel(row.period);
    const timeStr = row.created_at ? new Date(row.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
    const avgStr = row.avg_per_day != null ? row.avg_per_day : '—';
    li.innerHTML = '<span class="shared-stat"><strong>' + row.count + '</strong> ' + periodLabel + '</span><span class="shared-meta">avg ' + avgStr + '/day · ' + timeStr + '</span>';
    sharedList.appendChild(li);
  });
}

function showCommunitySetupMessage() {
  if (!sharedList || !sharedEmpty) return;
  sharedList.innerHTML = '';
  sharedEmpty.textContent = "Set up Supabase in config.js to share and see others' results. See README.";
  sharedEmpty.classList.remove('hidden');
}

function initSharing() {
  if (!shareSection) return;
  shareSection.classList.remove('hidden');
  if (communitySection) communitySection.classList.remove('hidden');
  if (btnShare) btnShare.addEventListener('click', shareAnonymously);
  if (btnRefreshFeed) btnRefreshFeed.addEventListener('click', fetchSharedStats);
  fetchSharedStats();
}

addBtn.addEventListener('click', addMistake);
addNoteInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addMistake();
});

periodTabs.forEach(tab => {
  tab.addEventListener('click', () => setPeriod(tab.dataset.period));
});

loadEntries();
renderStats();
renderList();
initSharing();
