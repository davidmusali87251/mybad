const STORAGE_KEY = 'mistake-tracker-entries';
const ANON_ID_KEY = 'mistake-tracker-anon-id';

let entries = [];
let currentPeriod = 'day';
let currentTypeFilter = 'all';
let lastEntry = null;
let lastShareAt = 0;

const CONFIG = (typeof window !== 'undefined' && window.MISTAKE_TRACKER_CONFIG) || {};
const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (CONFIG.SUPABASE_ANON_KEY || '').trim();
const SHARING_ENABLED = SUPABASE_URL && SUPABASE_ANON_KEY;

const addNoteInput = document.getElementById('mistake-note');
const addBtn = document.getElementById('add-mistake');
const quickAvoidableBtn = document.getElementById('btn-quick-avoidable');
const quickFertileBtn = document.getElementById('btn-quick-fertile');
const repeatLastBtn = document.getElementById('btn-repeat-last');
const typeInputs = document.querySelectorAll('input[name="mistake-type"]');
const periodTabs = document.querySelectorAll('.tab');
const statCount = document.getElementById('stat-count');
const statLabel = document.getElementById('stat-label');
const statAvg = document.getElementById('stat-avg');
const statExploration = document.getElementById('stat-exploration');
const statExplorationHint = document.getElementById('stat-exploration-hint');
const statExplorationSoWhat = document.getElementById('stat-exploration-so-what');
const statsBreakdown = document.getElementById('stats-breakdown');
const streakNote = document.getElementById('streak-note');
const progressSection = document.getElementById('progress-section');
const progressCards = document.getElementById('progress-cards');
const progressEmpty = document.getElementById('progress-empty');
const trendsSection = document.getElementById('trends-section');
const trendsChart = document.getElementById('trends-chart');
const trendsEmpty = document.getElementById('trends-empty');
const trendsHighlight = document.getElementById('trends-highlight');
const autoReflectionEl = document.getElementById('auto-reflection');
const entryList = document.getElementById('entry-list');
const emptyState = document.getElementById('empty-state');
const statsNote = document.getElementById('stats-note');
const historyFilters = document.getElementById('history-filters');
const exportCsvBtn = document.getElementById('btn-export-csv');
const shareSection = document.getElementById('share-section');
const btnShare = document.getElementById('btn-share');
const shareStatus = document.getElementById('share-status');
const sharedList = document.getElementById('shared-list');
const sharedEmpty = document.getElementById('shared-empty');
const btnRefreshFeed = document.getElementById('btn-refresh-feed');
const communityError = document.getElementById('community-error');
const communitySection = document.getElementById('community-section');
const communityEntriesSection = document.getElementById('community-entries-section');
const sharedEntriesList = document.getElementById('shared-entries-list');
const sharedEntriesEmpty = document.getElementById('shared-entries-empty');
const sharedEntriesError = document.getElementById('shared-entries-error');
const btnRefreshEntries = document.getElementById('btn-refresh-entries');
const reflectionAvoidable = document.getElementById('reflection-avoidable');
const reflectionFertile = document.getElementById('reflection-fertile');
const reflectionNote = document.getElementById('reflection-note');
const reflectionAvoidableCounter = document.getElementById('reflection-avoidable-counter');
const reflectionFertileCounter = document.getElementById('reflection-fertile-counter');
const yesterdayReflection = document.getElementById('yesterday-reflection');
const communityMetrics = document.getElementById('community-metrics');

const REFLECTIONS_KEY = 'mistake-tracker-reflections';

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    entries = [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Mistake Tracker: could not save to localStorage', e);
  }
}

function getTodayKey() {
  return String(getStartOfDay(Date.now()));
}

function loadReflections() {
  try {
    const raw = localStorage.getItem(REFLECTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveReflections(reflections) {
  localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(reflections));
}

function renderReflection() {
  if (!reflectionAvoidable || !reflectionFertile) return;
  const key = getTodayKey();
  const all = loadReflections();
  const today = all[key] || { avoidable: '', fertile: '' };
  reflectionAvoidable.value = today.avoidable || '';
  reflectionFertile.value = today.fertile || '';

  if (reflectionNote) {
    if (!today.avoidable && !today.fertile) {
      reflectionNote.textContent = 'At the end of the day, write one line for each: an avoidable pattern to reduce, and a fertile risk you’re glad you took.';
    } else {
      reflectionNote.textContent = 'Saved locally for today. Tomorrow you’ll see a fresh page.';
    }
  }

  updateReflectionCounters();
  renderYesterdayReflection();
}

function updateReflection(field, value) {
  const key = getTodayKey();
  const all = loadReflections();
  const today = all[key] || { avoidable: '', fertile: '' };
  today[field] = value;
  all[key] = today;
  saveReflections(all);
  if (reflectionNote) {
    if (!today.avoidable && !today.fertile) {
      reflectionNote.textContent = 'At the end of the day, write one line for each: an avoidable pattern to reduce, and a fertile risk you’re glad you took.';
    } else {
      reflectionNote.textContent = 'Saved locally for today. Tomorrow you’ll see a fresh page.';
    }
  }
}

function renderYesterdayReflection() {
  if (!yesterdayReflection) return;
  const all = loadReflections();
  const dayMs = 86400000;
  const yesterdayKey = String(getStartOfDay(Date.now() - dayMs));
  const y = all[yesterdayKey];
  if (!y || (!y.avoidable && !y.fertile)) {
    yesterdayReflection.textContent = '';
    return;
  }
  let text = 'Yesterday — ';
  if (y.avoidable) {
    text += 'Avoidable: ' + y.avoidable;
  }
  if (y.fertile) {
    if (y.avoidable) text += ' · ';
    text += 'Fertile: ' + y.fertile;
  }
  yesterdayReflection.textContent = text;
}

function updateReflectionCounters() {
  if (reflectionAvoidableCounter && reflectionAvoidable) {
    const len = (reflectionAvoidable.value || '').length;
    reflectionAvoidableCounter.textContent = len + ' character' + (len === 1 ? '' : 's');
  }
  if (reflectionFertileCounter && reflectionFertile) {
    const len = (reflectionFertile.value || '').length;
    reflectionFertileCounter.textContent = len + ' character' + (len === 1 ? '' : 's');
  }
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

  if (statCount) statCount.textContent = count;
  if (statLabel) statLabel.textContent = getPeriodLabel(currentPeriod);
  if (statAvg) statAvg.textContent = avg;

  if (statsBreakdown) {
    if (count === 0) {
      statsBreakdown.textContent = '';
    } else {
      statsBreakdown.textContent =
        'Avoidable: ' + avoidableCount + ' · Fertile: ' + fertileCount;
    }
  }

  if (statsNote) {
    if (count === 0) {
      statsNote.textContent = "No mistakes logged this period. That's okay—just check that you're still exploring and learning.";
    } else {
      statsNote.textContent =
        avoidableCount + " avoidable (aim to reduce) · " +
        fertileCount + " fertile (valuable experiments)";
    }
  }

  if (streakNote) {
    const streak = getCurrentStreak();
    if (streak <= 0) {
      streakNote.textContent = '';
    } else if (streak === 1) {
      streakNote.textContent = 'You have a 1-day logging streak.';
    } else {
      streakNote.textContent = 'You have a ' + streak + '-day logging streak.';
    }
  }

  // Exploration index: fertile / total (goal: higher = more experimentation)
  if (statExploration) {
    if (count === 0) {
      statExploration.textContent = '—';
      if (statExplorationHint) statExplorationHint.textContent = 'fertile ÷ total';
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = '';
    } else {
      const ratio = fertileCount / count;
      const pct = Math.round(ratio * 100);
      statExploration.textContent = pct + '%';
      if (statExplorationHint) statExplorationHint.textContent = fertileCount + ' fertile ÷ ' + count + ' total';
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = getExplorationSoWhat(pct);
    }
  }
  renderTrends();
  renderProgress();
  renderAutoReflection();
}

function getExplorationSoWhat(pct) {
  if (pct >= 70) return 'Lots of experimenting.';
  if (pct >= 50) return 'Good mix of risk and care.';
  if (pct >= 30) return 'Room to add more experiments.';
  if (pct >= 10) return 'Aim for more fertile mistakes.';
  if (pct > 0) return 'One small experiment can help.';
  return 'Try one stretch today.';
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
  if (!entryList) return;
  const filtered = filterByPeriod(currentPeriod).filter(e => {
    if (currentTypeFilter === 'all') return true;
    return (e.type || 'avoidable') === currentTypeFilter;
  });
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

  if (emptyState) emptyState.classList.toggle('hidden', show.length > 0);
}

function getWeekBounds(weeksAgo) {
  const now = Date.now();
  const dayMs = 86400000;
  const thisWeekStart = getStartOfWeek(now);
  const weekStart = thisWeekStart - weeksAgo * 7 * dayMs;
  return { start: weekStart, end: weekStart + 7 * dayMs };
}

function getThisWeekAndLastWeek() {
  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(1);
  const inThisWeek = entries.filter(e => e.at >= thisWeek.start && e.at < thisWeek.end);
  const inLastWeek = entries.filter(e => e.at >= lastWeek.start && e.at < lastWeek.end);
  const toStats = (list) => {
    const total = list.length;
    const fertile = list.filter(e => (e.type || 'avoidable') === 'fertile').length;
    const exploration = total > 0 ? Math.round((fertile / total) * 100) : null;
    return { total, fertile, avoidable: total - fertile, exploration };
  };
  return { thisWeek: toStats(inThisWeek), lastWeek: toStats(inLastWeek) };
}

function renderProgress() {
  if (!progressCards || !progressEmpty) return;
  const { thisWeek, lastWeek } = getThisWeekAndLastWeek();
  const hasData = thisWeek.total > 0 || lastWeek.total > 0;
  progressEmpty.classList.toggle('hidden', hasData);
  progressCards.classList.toggle('hidden', !hasData);
  if (!hasData) {
    progressCards.innerHTML = '';
    return;
  }
  progressCards.innerHTML = '';
  const renderWeekCard = (label, stats, isThisWeek) => {
    const card = document.createElement('div');
    card.className = 'progress-card' + (isThisWeek ? ' progress-card-current' : '');
    const title = document.createElement('span');
    title.className = 'progress-card-title';
    title.textContent = label;
    card.appendChild(title);
    const totalEl = document.createElement('span');
    totalEl.className = 'progress-card-total';
    totalEl.textContent = stats.total + ' mistakes';
    card.appendChild(totalEl);
    const explEl = document.createElement('span');
    explEl.className = 'progress-card-exploration';
    explEl.textContent = stats.exploration != null ? stats.exploration + '% exploration' : '—';
    card.appendChild(explEl);
    return card;
  };
  progressCards.appendChild(renderWeekCard('This week', thisWeek, true));
  progressCards.appendChild(renderWeekCard('Last week', lastWeek, false));
  const diff = document.createElement('div');
  diff.className = 'progress-diff';
  const totalDiff = thisWeek.total - lastWeek.total;
  const explDiff = (thisWeek.exploration != null && lastWeek.exploration != null)
    ? thisWeek.exploration - lastWeek.exploration
    : null;
  let diffText = '';
  if (lastWeek.total === 0 && thisWeek.total > 0) diffText = 'You\'ve started logging this week.';
  else if (thisWeek.total === 0 && lastWeek.total > 0) diffText = 'No mistakes logged this week yet.';
  else if (totalDiff !== 0 || (explDiff !== null && explDiff !== 0)) {
    const parts = [];
    if (totalDiff < 0) parts.push('Fewer mistakes than last week.');
    else if (totalDiff > 0) parts.push('More mistakes than last week.');
    if (explDiff !== null && explDiff > 0) parts.push('Higher exploration—more fertile.');
    else if (explDiff !== null && explDiff < 0) parts.push('Lower exploration than last week.');
    diffText = parts.join(' ') || 'Similar to last week.';
  } else diffText = 'Similar to last week.';
  diff.textContent = diffText;
  progressCards.appendChild(diff);
}

function getDayCountsLastN(n) {
  const now = Date.now();
  const dayMs = 86400000;
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const dayStart = getStartOfDay(now - i * dayMs);
    const dayEnd = dayStart + dayMs;
    const dayEntries = entries.filter(e => e.at >= dayStart && e.at < dayEnd);
    const avoidable = dayEntries.filter(e => (e.type || 'avoidable') === 'avoidable').length;
    const fertile = dayEntries.filter(e => (e.type || 'avoidable') === 'fertile').length;
    result.push({
      dayStart,
      avoidable,
      fertile,
      total: avoidable + fertile
    });
  }
  return result;
}

function renderTrends() {
  if (!trendsChart || !trendsEmpty) return;
  const days = getDayCountsLastN(7);
  const maxVal = Math.max(1, ...days.map(d => Math.max(d.avoidable, d.fertile, 1)));
  const hasAny = days.some(d => d.total > 0);
  trendsEmpty.classList.toggle('hidden', hasAny);
  trendsChart.classList.toggle('hidden', !hasAny);
  if (!hasAny) {
    trendsChart.innerHTML = '';
    if (trendsHighlight) trendsHighlight.textContent = '';
    return;
  }
  trendsChart.innerHTML = '';
  const dayLabels = days.map((d, i) => {
    const date = new Date(d.dayStart);
    return date.toLocaleDateString([], { weekday: 'short' });
  });
  days.forEach((d, i) => {
    const col = document.createElement('div');
    col.className = 'trends-day';
    const label = document.createElement('span');
    label.className = 'trends-day-label';
    label.textContent = dayLabels[i];
    col.appendChild(label);
    const bars = document.createElement('div');
    bars.className = 'trends-bars';
    const avoidableH = maxVal > 0 ? (d.avoidable / maxVal) * 100 : 0;
    const fertileH = maxVal > 0 ? (d.fertile / maxVal) * 100 : 0;
    const barA = document.createElement('div');
    barA.className = 'trends-bar trends-bar-avoidable';
    barA.style.height = avoidableH + '%';
    barA.title = d.avoidable + ' avoidable';
    bars.appendChild(barA);
    const barF = document.createElement('div');
    barF.className = 'trends-bar trends-bar-fertile';
    barF.style.height = fertileH + '%';
    barF.title = d.fertile + ' fertile';
    bars.appendChild(barF);
    col.appendChild(bars);
    const vals = document.createElement('span');
    vals.className = 'trends-day-vals';
    vals.textContent = (d.avoidable + d.fertile) > 0 ? d.avoidable + '↓ ' + d.fertile + '↑' : '—';
    col.appendChild(vals);
    trendsChart.appendChild(col);
  });
  if (trendsHighlight) {
    let best = null;
    days.forEach(d => {
      if (d.total <= 0) return;
      const ratio = d.fertile / d.total;
      if (!best || ratio > best.ratio) {
        best = { ratio, dayStart: d.dayStart };
      }
    });
    if (!best) {
      trendsHighlight.textContent = '';
    } else {
      const date = new Date(best.dayStart);
      const label = date.toLocaleDateString([], { weekday: 'short' });
      const pct = Math.round(best.ratio * 100);
      trendsHighlight.textContent =
        'Best exploration day (last 7): ' + label + ' at ' + pct + '%.';
    }
  }
}

const AUTO_REFLECTION_PHRASES = {
  oneFertile: [
    "One fertile mistake today—you're stretching.",
    "One experiment logged. That's the kind of mistake that pays off."
  ],
  oneAvoidable: [
    "One avoidable today—small slip, no big deal.",
    "A single avoidable. Notice the trigger so it doesn't become a pattern."
  ],
  highFertile: [
    "Today: {f} fertile, {a} avoidable. More experiments than slip-ups—good balance.",
    "Today: {f} fertile, {a} avoidable. You're leaning into the right kind of risk.",
    "{f} fertile and {a} avoidable today. The ratio is moving in a good direction."
  ],
  mixed: [
    "Today: {a} avoidable, {f} fertile. Mixed day—keep an eye on repeat avoidables.",
    "Today: {a} avoidable, {f} fertile. One less avoidable tomorrow would be a win.",
    "{a} avoidable and {f} fertile. Which avoidable could you eliminate tomorrow?"
  ],
  lowFertile: [
    "Today: {a} avoidable, {f} fertile. Aim to reduce the avoidable pattern and keep taking fertile risks.",
    "{a} avoidable, {f} fertile. Consider one small experiment you've been putting off.",
    "More avoidable than fertile today. Tomorrow: same care, plus one deliberate stretch."
  ],
  allAvoidable: [
    "Today: {a} avoidable. All avoidable—consider where you can add one small experiment.",
    "{a} avoidable today, zero fertile. What's one thing you could try that might fail in a useful way?",
    "No fertile mistakes today. A single stretch or experiment would balance the ledger."
  ]
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAutoReflection() {
  const todayStart = getStartOfDay(Date.now());
  const todayEnd = todayStart + 86400000;
  const todayEntries = entries.filter(e => e.at >= todayStart && e.at < todayEnd);
  const avoidable = todayEntries.filter(e => (e.type || 'avoidable') === 'avoidable').length;
  const fertile = todayEntries.filter(e => (e.type || 'avoidable') === 'fertile').length;
  const total = avoidable + fertile;
  if (total === 0) return '';
  const ratio = fertile / total;
  const a = avoidable, f = fertile;
  if (total === 1) {
    return fertile ? pick(AUTO_REFLECTION_PHRASES.oneFertile) : pick(AUTO_REFLECTION_PHRASES.oneAvoidable);
  }
  if (ratio >= 0.6) return pick(AUTO_REFLECTION_PHRASES.highFertile).replace(/\{f\}/g, f).replace(/\{a\}/g, a);
  if (ratio >= 0.4) return pick(AUTO_REFLECTION_PHRASES.mixed).replace(/\{a\}/g, a).replace(/\{f\}/g, f);
  if (ratio > 0) return pick(AUTO_REFLECTION_PHRASES.lowFertile).replace(/\{a\}/g, a).replace(/\{f\}/g, f);
  return pick(AUTO_REFLECTION_PHRASES.allAvoidable).replace(/\{a\}/g, a);
}

function renderAutoReflection() {
  if (!autoReflectionEl) return;
  const text = generateAutoReflection();
  if (!text) {
    autoReflectionEl.textContent = '';
    autoReflectionEl.classList.add('hidden');
    return;
  }
  autoReflectionEl.textContent = text;
  autoReflectionEl.classList.remove('hidden');
}

function getCurrentStreak() {
  if (!entries || entries.length === 0) return 0;
  const dayMs = 86400000;
  const daysWithEntries = new Set(
    entries.map(e => String(getStartOfDay(e.at)))
  );
  let streak = 0;
  let cursor = getStartOfDay(Date.now());
  while (daysWithEntries.has(String(cursor))) {
    streak += 1;
    cursor -= dayMs;
  }
  return streak;
}

function getSelectedType() {
  if (!typeInputs || typeInputs.length === 0) return 'avoidable';
  const checked = Array.from(typeInputs).find(i => i.checked);
  return (checked && checked.value) || 'avoidable';
}

function addMistake() {
  const note = (addNoteInput.value || '').trim();
  const type = getSelectedType();
  const entry = { at: Date.now(), note, type };
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  addNoteInput.value = '';
  if (addNoteInput) addNoteInput.focus();
  renderStats();
  renderList();
  if (SHARING_ENABLED) pushEntryToShared({ note, type });
}

function pushEntryToShared(entry) {
  try {
    getSupabase()
      .from('shared_entries')
      .insert({ note: entry.note || null, type: entry.type || 'avoidable' })
      .then(({ error }) => {
        if (!error && typeof fetchSharedEntries === 'function') fetchSharedEntries();
      });
  } catch (_) {}
}

function setPeriod(period) {
  currentPeriod = period;
  periodTabs.forEach(t => t.classList.toggle('active', t.dataset.period === period));
  renderStats();
  renderList();
}

// --- Anonymous sharing (Supabase) ---
function getOrCreateAnonId() {
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id || id.length < 10) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

function getSupabase() {
  if (!SHARING_ENABLED) {
    throw new Error('Sharing is not enabled (missing Supabase config).');
  }
  if (typeof supabase === 'undefined') {
    throw new Error('Supabase client library did not load.');
  }
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
  const now = Date.now();
  if (now - lastShareAt < 15000) {
    shareStatus.textContent = 'Please wait a few seconds between shares.';
    shareStatus.className = 'share-status error';
    return;
  }
  shareStatus.textContent = 'Sharing…';
  shareStatus.className = 'share-status';
  btnShare.disabled = true;
  try {
    const stats = getCurrentStatsForShare();
    const client = getSupabase();
    const { error } = await client.from('shared_stats').insert({
      period: stats.period,
      count: stats.count,
      avg_per_day: stats.avg_per_day,
      anonymous_id: getOrCreateAnonId()
    });
    if (error) {
      throw error;
    }
    lastShareAt = Date.now();
    shareStatus.textContent = 'Shared anonymously.';
    shareStatus.className = 'share-status success';
    setTimeout(() => { shareStatus.textContent = ''; }, 3000);
    fetchSharedStats();
  } catch (err) {
    const raw = (err && (err.message || err.error_description || err.msg)) || (typeof err === 'string' ? err : '');
    const msg = typeof raw === 'string' ? raw : (raw && raw.message) || 'Unknown error';
    const isUnregisteredKey = /unregistered\s*api\s*key/i.test(msg);
    shareStatus.textContent = 'Failed: ' + (isUnregisteredKey ? 'Unregistered API key' : msg);
    shareStatus.className = 'share-status error';
  } finally {
    btnShare.disabled = false;
  }
}

function quickAdd(type) {
  const entry = { at: Date.now(), note: '', type };
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  renderStats();
  renderList();
  if (SHARING_ENABLED) pushEntryToShared({ note: '', type });
}

function repeatLastNote() {
  if (!lastEntry && entries.length === 0) return;
  const base = lastEntry || entries[entries.length - 1];
  const entry = {
    at: Date.now(),
    note: base.note || '',
    type: base.type || 'avoidable'
  };
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  renderStats();
  renderList();
  if (SHARING_ENABLED) pushEntryToShared({ note: entry.note, type: entry.type });
}

function exportCsv() {
  const rows = [];
  rows.push(['timestamp_iso', 'type', 'note']);
  entries.forEach(e => {
    const ts = new Date(e.at).toISOString();
    const type = e.type || 'avoidable';
    const note = (e.note || '').replace(/"/g, '""');
    rows.push([ts, type, `"${note}"`]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mistakes.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchSharedStats() {
  if (!SHARING_ENABLED) {
    showCommunitySetupMessage();
    return;
  }
  communityError.classList.add('hidden');
  communityError.textContent = '';
  const client = getSupabase();
  const MAX_OTHER_RESULTS = 10;
  const { data, error } = await client
    .from('shared_stats')
    .select('id, period, count, avg_per_day, created_at, anonymous_id')
    .order('created_at', { ascending: false })
    .limit(MAX_OTHER_RESULTS);
  if (error) {
    const raw = error.message || error.error_description || error.msg || '';
    const isUnregisteredKey = /unregistered\s*api\s*key/i.test(raw);
    communityError.textContent = 'Could not load: ' + (isUnregisteredKey ? 'Unregistered API key' : (raw || 'Unknown error'));
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
  const limited = data.slice(0, MAX_OTHER_RESULTS);
  // Group by anonymous_id (same browser = same anonymous person)
  const byAnon = {};
  limited.forEach(row => {
    const key = row.anonymous_id || '__anon__';
    if (!byAnon[key]) byAnon[key] = [];
    byAnon[key].push(row);
  });
  // Sort groups by most recent share first
  const groupKeys = Object.keys(byAnon).sort((a, b) => {
    const aMax = Math.max(...byAnon[a].map(r => new Date(r.created_at).getTime()));
    const bMax = Math.max(...byAnon[b].map(r => new Date(r.created_at).getTime()));
    return bMax - aMax;
  });
  sharedList.innerHTML = '';
  groupKeys.forEach(anonKey => {
    const rows = byAnon[anonKey] || [];
    const groupLabel = document.createElement('li');
    groupLabel.className = 'shared-group-label';
    const shareCount = rows.length;
    groupLabel.textContent = shareCount === 1 ? "Someone's share" : "Someone's shares (" + shareCount + ")";
    sharedList.appendChild(groupLabel);
    rows.forEach(row => {
      const li = document.createElement('li');
      li.className = 'shared-item';
      const periodLabel = getPeriodLabel(row.period);
      const timeStr = row.created_at ? new Date(row.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
      const avgStr = row.avg_per_day != null ? row.avg_per_day : '—';
      li.innerHTML = '<span class="shared-stat"><strong>' + row.count + '</strong> ' + periodLabel + '</span><span class="shared-meta">avg ' + avgStr + '/day · ' + timeStr + '</span>';
      sharedList.appendChild(li);
    });
  });
  if (communityMetrics) {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;
    const recentRows = limited.filter(row => {
      if (!row.created_at) return false;
      const ts = new Date(row.created_at).getTime();
      return ts >= sevenDaysAgo;
    });
    const uniquePeople = {};
    recentRows.forEach(row => {
      const key = row.anonymous_id || '__anon__';
      uniquePeople[key] = true;
    });
    const shareCount = recentRows.length;
    const peopleCount = Object.keys(uniquePeople).length;
    if (shareCount === 0) {
      communityMetrics.textContent = '';
    } else {
      communityMetrics.textContent =
        'Last 7 days: ' +
        shareCount +
        ' share' +
        (shareCount === 1 ? '' : 's') +
        ' from ' +
        peopleCount +
        ' person' +
        (peopleCount === 1 ? '' : 's') +
        ' (approximate).';
    }
  }
}

function showCommunitySetupMessage() {
  if (!sharedList || !sharedEmpty) return;
  sharedList.innerHTML = '';
  sharedEmpty.textContent = "Set up Supabase in config.js to share and see others' results. See README.";
  sharedEmpty.classList.remove('hidden');
}

function formatTimeFromISO(isoStr) {
  if (!isoStr) return '';
  const ts = new Date(isoStr).getTime();
  return formatTime(ts);
}

async function fetchSharedEntries() {
  if (!SHARING_ENABLED) {
    if (communityEntriesSection) communityEntriesSection.classList.add('hidden');
    return;
  }
  if (!sharedEntriesList || !sharedEntriesEmpty) return;
  if (communityEntriesSection) communityEntriesSection.classList.remove('hidden');
  if (sharedEntriesError) {
    sharedEntriesError.classList.add('hidden');
    sharedEntriesError.textContent = '';
  }
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('shared_entries')
      .select('id, note, type, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    sharedEntriesList.innerHTML = '';
    const list = data || [];
    sharedEntriesEmpty.classList.toggle('hidden', list.length > 0);
    sharedEntriesEmpty.textContent = list.length === 0 ? "No shared entries yet. Add a mistake to share yours." : "";
    list.forEach(row => {
      const li = document.createElement('li');
      li.className = 'entry-item';
      const badge = document.createElement('span');
      const type = row.type || 'avoidable';
      badge.className = 'badge ' + (type === 'fertile' ? 'badge-fertile' : 'badge-avoidable');
      badge.textContent = type === 'fertile' ? 'FERTILE' : 'AVOIDABLE';
      const note = document.createElement('span');
      note.className = 'note' + (row.note ? '' : ' empty');
      note.textContent = row.note || '(no note)';
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = formatTimeFromISO(row.created_at);
      li.appendChild(badge);
      li.appendChild(note);
      li.appendChild(time);
      sharedEntriesList.appendChild(li);
    });
  } catch (err) {
    const raw = err && (err.message || err.error_description || err.msg) || '';
    const msg = typeof raw === 'string' ? raw : (raw && raw.message) || 'Unknown error';
    if (sharedEntriesError) {
      sharedEntriesError.textContent = 'Could not load: ' + (/unregistered\s*api\s*key/i.test(msg) ? 'Unregistered API key' : msg);
      sharedEntriesError.classList.remove('hidden');
    }
    sharedEntriesList.innerHTML = '';
    if (sharedEntriesEmpty) {
      sharedEntriesEmpty.textContent = "Could not load everyone's entries. Check config and try again.";
      sharedEntriesEmpty.classList.remove('hidden');
    }
  }
}

function showCommunityEntriesSetupMessage() {
  if (!sharedEntriesList || !sharedEntriesEmpty) return;
  sharedEntriesList.innerHTML = '';
  sharedEntriesEmpty.textContent = "Set up Supabase in config.js to see everyone's entries. See README.";
  sharedEntriesEmpty.classList.remove('hidden');
}

function initSharing() {
  if (!shareSection) return;
  shareSection.classList.remove('hidden');
  if (communitySection) communitySection.classList.remove('hidden');
  if (btnShare) btnShare.addEventListener('click', shareAnonymously);
  if (btnRefreshFeed) btnRefreshFeed.addEventListener('click', fetchSharedStats);
  fetchSharedStats();
  if (SHARING_ENABLED && communityEntriesSection) {
    communityEntriesSection.classList.remove('hidden');
    if (btnRefreshEntries) btnRefreshEntries.addEventListener('click', fetchSharedEntries);
    fetchSharedEntries();
  } else if (communityEntriesSection) {
    communityEntriesSection.classList.add('hidden');
  }
}

function initReflection() {
  if (!reflectionAvoidable || !reflectionFertile) return;
  renderReflection();
  reflectionAvoidable.addEventListener('blur', () => {
    updateReflection('avoidable', reflectionAvoidable.value.trim());
  });
  reflectionFertile.addEventListener('blur', () => {
    updateReflection('fertile', reflectionFertile.value.trim());
  });
  reflectionAvoidable.addEventListener('input', updateReflectionCounters);
  reflectionFertile.addEventListener('input', updateReflectionCounters);
}

if (addBtn) addBtn.addEventListener('click', addMistake);
if (addNoteInput) addNoteInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addMistake();
});

if (quickAvoidableBtn) quickAvoidableBtn.addEventListener('click', () => quickAdd('avoidable'));
if (quickFertileBtn) quickFertileBtn.addEventListener('click', () => quickAdd('fertile'));
if (repeatLastBtn) repeatLastBtn.addEventListener('click', repeatLastNote);

if (historyFilters) {
  historyFilters.addEventListener('click', e => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains('history-filter')) return;
    const type = target.dataset.type || 'all';
    currentTypeFilter = type;
    const buttons = historyFilters.querySelectorAll('.history-filter');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn === target);
    });
    renderList();
  });
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', exportCsv);
}

periodTabs.forEach(tab => {
  if (tab) tab.addEventListener('click', () => setPeriod(tab.dataset.period));
});

loadEntries();
renderStats();
renderList();
initSharing();
initReflection();
