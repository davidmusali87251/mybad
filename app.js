// Mode: "personal" (default) or "inside" (SlipUp Inside)
const MODE = (typeof window !== 'undefined' && window.SLIPUP_MODE) || 'personal';

const STORAGE_KEY = MODE === 'inside' ? 'mistake-tracker-entries-inside' : 'mistake-tracker-entries';
const ANON_ID_KEY = MODE === 'inside' ? 'mistake-tracker-anon-id-inside' : 'mistake-tracker-anon-id';

// Supabase: stats table per mode; one table for all "what happened" entries
const STATS_TABLE = MODE === 'inside' ? 'shared_stats_inside' : 'shared_stats';
const ENTRIES_TABLE = 'shared_what_happened';
const EVENTS_TABLE = 'slipup_events';

let entries = [];
let currentPeriod = 'day';
let currentTypeFilter = 'all';
let lastEntry = null;
let lastShareAt = 0;

const CONFIG = (typeof window !== 'undefined' && window.MISTAKE_TRACKER_CONFIG) || {};
// Normalize Supabase URL: trim and remove trailing slash (avoids "Invalid API key" from wrong URL format)
const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (CONFIG.SUPABASE_ANON_KEY || '').trim();
const SHARING_ENABLED = SUPABASE_URL && SUPABASE_ANON_KEY;
const FREE_ENTRY_LIMIT = 10;
const UNLOCKED_KEY = 'mistake-tracker-unlocked';
const PAYMENT_LINK_CLICKED_KEY = 'mistake-tracker-payment-link-clicked';
const PAYMENT_URL = (CONFIG.PAYMENT_URL || '').trim();
const PAYPAL_CLIENT_ID = (CONFIG.PAYPAL_CLIENT_ID || '').trim();
const PAYPAL_HOSTED_BUTTON_ID = (CONFIG.PAYPAL_HOSTED_BUTTON_ID || '').trim();
const PAYPAL_ENABLED = PAYPAL_CLIENT_ID && PAYPAL_HOSTED_BUTTON_ID;

const addNoteInput = document.getElementById('mistake-note');
const addBtn = document.getElementById('add-mistake');
const quickAvoidableBtn = document.getElementById('btn-quick-avoidable');
const quickFertileBtn = document.getElementById('btn-quick-fertile');
const quickObservedBtn = document.getElementById('btn-quick-observed');
const repeatLastBtn = document.getElementById('btn-repeat-last');
const typeInputs = document.querySelectorAll('input[name="mistake-type"]');
const typeHint = document.getElementById('type-hint');
const communityComparison = document.getElementById('community-comparison');

const TYPE_PHRASES = {
  avoidable: 'Notice the trigger. How can I reduce repeats?',
  fertile: 'What did I try? What did I learn?',
  observed: 'For learning, not blaming. What did I see? What lesson applies to me?'
};
const TYPE_PLACEHOLDERS = {
  avoidable: 'e.g. Forgot to save, spoke harshly…',
  fertile: 'e.g. Tried a new approach, missed the mark…',
  observed: 'What did I see? What lesson applies to me?'
};
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
const communityEntriesTrend = document.getElementById('community-entries-trend');
const reflectionAvoidable = document.getElementById('reflection-avoidable');
const reflectionFertile = document.getElementById('reflection-fertile');
const reflectionNote = document.getElementById('reflection-note');
const reflectionAvoidableCounter = document.getElementById('reflection-avoidable-counter');
const reflectionFertileCounter = document.getElementById('reflection-fertile-counter');
const yesterdayReflection = document.getElementById('yesterday-reflection');
const communityMetrics = document.getElementById('community-metrics');
const limitMessage = document.getElementById('limit-message');
const upgradeCards = document.getElementById('upgrade-cards');
const unlockedBadge = document.getElementById('unlocked-badge');
const btnBuy = document.getElementById('btn-buy');
const paypalButtonContainer = document.getElementById('paypal-button-container');
const btnUnlockAfterPay = document.getElementById('btn-unlock-after-pay');
const btnBuyUnlocked = document.getElementById('btn-buy-unlocked');

const REFLECTIONS_KEY = MODE === 'inside' ? 'mistake-tracker-reflections-inside' : 'mistake-tracker-reflections';
let paypalButtonRendered = false;

function isUnlocked() {
  return localStorage.getItem(UNLOCKED_KEY) === 'true';
}

function setUnlocked() {
  localStorage.setItem(UNLOCKED_KEY, 'true');
  updateUpgradeUI();
  renderStats();
  updateAddButtonState();
}

function isAtLimit() {
  return !isUnlocked() && entries.length >= FREE_ENTRY_LIMIT;
}

function hasClickedPaymentLink() {
  try {
    return sessionStorage.getItem(PAYMENT_LINK_CLICKED_KEY) === 'true';
  } catch {
    return false;
  }
}

function setPaymentLinkClicked() {
  try {
    sessionStorage.setItem(PAYMENT_LINK_CLICKED_KEY, 'true');
  } catch (_) {}
}

function updateUpgradeUI() {
  const unlocked = isUnlocked();
  if (unlockedBadge) unlockedBadge.classList.toggle('hidden', !unlocked);
  if (upgradeCards) upgradeCards.classList.toggle('hidden', unlocked);
  if (limitMessage) limitMessage.classList.toggle('hidden', !isAtLimit());
  const atLimit = isAtLimit();
  [quickAvoidableBtn, quickFertileBtn, quickObservedBtn, repeatLastBtn].forEach(btn => {
    if (btn) btn.disabled = atLimit;
  });
  if (PAYPAL_ENABLED && paypalButtonContainer) {
    paypalButtonContainer.classList.remove('hidden');
    loadPayPalButton();
  } else if (paypalButtonContainer) {
    paypalButtonContainer.classList.add('hidden');
  }
  if (btnBuy) {
    if (PAYMENT_URL) {
      btnBuy.href = PAYMENT_URL;
      btnBuy.classList.remove('hidden');
    } else {
      btnBuy.classList.add('hidden');
    }
  }
  if (btnBuyUnlocked) {
    if (unlocked && PAYMENT_URL) {
      btnBuyUnlocked.href = PAYMENT_URL;
      btnBuyUnlocked.classList.remove('hidden');
    } else {
      btnBuyUnlocked.classList.add('hidden');
    }
  }
  if (btnUnlockAfterPay) {
    btnUnlockAfterPay.disabled = !hasClickedPaymentLink();
  }
}

function loadPayPalButton() {
  if (paypalButtonRendered || !PAYPAL_ENABLED || !paypalButtonContainer) return;
  if (window.paypal && window.paypal.HostedButtons) {
    window.paypal.HostedButtons({
      hostedButtonId: PAYPAL_HOSTED_BUTTON_ID
    }).render('#paypal-button-container').then(function() {
      paypalButtonRendered = true;
    }).catch(function() {});
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(PAYPAL_CLIENT_ID) + '&components=hosted-buttons&disable-funding=venmo&currency=USD';
  script.async = true;
  script.onload = function() {
    if (window.paypal && window.paypal.HostedButtons && !paypalButtonRendered) {
      window.paypal.HostedButtons({
        hostedButtonId: PAYPAL_HOSTED_BUTTON_ID
      }).render('#paypal-button-container').then(function() {
        paypalButtonRendered = true;
      }).catch(function() {});
    }
  };
  document.head.appendChild(script);
}

function updateAddButtonState() {
  if (!addBtn || !addNoteInput) return;
  const hasText = (addNoteInput.value || '').trim().length > 0;
  const atLimit = isAtLimit();
  addBtn.disabled = !hasText || atLimit;
}

// Optional scope for future team/context: "personal" | "observed" | "team". Default "personal".
function normalizeScope(entry) {
  const s = entry.scope;
  return s === 'observed' || s === 'team' ? s : 'personal';
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    entries = Array.isArray(parsed) ? parsed.map(e => ({ ...e, scope: normalizeScope(e) })) : [];
  } catch {
    entries = [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('SlipUp: could not save to localStorage', e);
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
  const observedCount = filtered.filter(e => e.type === 'observed').length;

  if (statCount) statCount.textContent = count;
  if (statLabel) statLabel.textContent = getPeriodLabel(currentPeriod);
  if (statAvg) statAvg.textContent = avg;

  if (statsBreakdown) {
    if (count === 0) {
      statsBreakdown.textContent = '';
    } else {
      statsBreakdown.textContent =
        'Avoidable: ' + avoidableCount +
        ' · Fertile: ' + fertileCount +
        ' · Observed: ' + observedCount;
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

  // Exploration index: fertile ÷ (avoidable + fertile)
  if (statExploration) {
    const primaryTotal = avoidableCount + fertileCount;
    if (primaryTotal === 0) {
      statExploration.textContent = '—';
      if (statExplorationHint) statExplorationHint.textContent = 'fertile ÷ (avoidable + fertile)';
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = '';
    } else {
      const ratio = fertileCount / primaryTotal;
      const pct = Math.round(ratio * 100);
      statExploration.textContent = pct + '%';
      if (statExplorationHint) statExplorationHint.textContent = fertileCount + ' fertile ÷ ' + primaryTotal + ' (avoidable + fertile)';
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
    let badgeClass = 'badge-avoidable';
    let label = 'AVOIDABLE';
    if (type === 'fertile') {
      badgeClass = 'badge-fertile';
      label = 'FERTILE';
    } else if (type === 'observed') {
      badgeClass = 'badge-observed';
      label = 'OBSERVED';
    }
    badge.className = 'badge ' + badgeClass;
    badge.textContent = label;
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
    let avoidable = 0;
    let fertile = 0;
    list.forEach(e => {
      const t = e.type || 'avoidable';
      if (t === 'fertile') fertile += 1;
      else if (t === 'avoidable') avoidable += 1;
    });
    const totalPrimary = avoidable + fertile;
    const observed = list.length - totalPrimary;
    const exploration = totalPrimary > 0 ? Math.round((fertile / totalPrimary) * 100) : null;
    return { total: totalPrimary, fertile, avoidable, observed, exploration };
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
  if (isAtLimit()) return;
  const note = (addNoteInput.value || '').trim();
  if (!note) return;
  const type = getSelectedType();
  const scope = type === 'observed' ? 'observed' : 'personal';
  const entry = { at: Date.now(), note, type, scope };
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  addNoteInput.value = '';
  updateAddButtonState();
  updateUpgradeUI();
  if (addNoteInput) addNoteInput.focus();
  renderStats();
  renderList();
  if (SHARING_ENABLED) pushEntryToShared({ note, type });
}

function pushEntryToShared(entry) {
  if (!SHARING_ENABLED) return;
  try {
    const now = new Date();
    const payload = {
      note: entry.note || null,
      type: entry.type || 'avoidable',
      mode: MODE,
      hour_utc: now.getUTCHours()
    };
    getSupabase()
      .from(ENTRIES_TABLE)
      .insert(payload)
      .then(({ error }) => {
        if (error) {
          const msg = error.message || error.error_description || (error.msg && error.msg.message) || JSON.stringify(error);
          if (sharedEntriesError) {
            sharedEntriesError.textContent = 'Could not add this entry to the feed: ' + msg;
            sharedEntriesError.classList.remove('hidden');
          }
          console.warn('SlipUp: shared_what_happened insert failed', error);
          return;
        }
        if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
      })
      .catch((err) => {
        const msg = err && (err.message || err.toString());
        if (sharedEntriesError) {
          sharedEntriesError.textContent = 'Could not add this entry to the feed: ' + (msg || 'Network or request error');
          sharedEntriesError.classList.remove('hidden');
        }
        console.warn('SlipUp: shared_what_happened insert error', err);
      });
  } catch (e) {
    if (sharedEntriesError) {
      sharedEntriesError.textContent = 'Could not share entry: ' + (e && e.message ? e.message : 'Check config (Supabase URL and anon key).');
      sharedEntriesError.classList.remove('hidden');
    }
    console.warn('SlipUp: pushEntryToShared failed', e);
  }
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
  // Basic format check: URL should be Supabase host, key should be a JWT (eyJ...)
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)) {
    throw new Error('Invalid Supabase URL. Use https://YOUR_PROJECT_REF.supabase.co (no trailing slash). Set in config.js locally or in repo Secrets for deploy.');
  }
  if (!SUPABASE_ANON_KEY.startsWith('eyJ')) {
    throw new Error('Invalid Supabase anon key. Use the anon public key from Supabase → Settings → API (JWT starting with eyJ...). Set in config.js locally or in repo Secrets for deploy.');
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
    if (shareStatus) {
      shareStatus.textContent = 'Set SUPABASE_URL and SUPABASE_ANON_KEY (config.js locally, or repo Secrets for deploy) to enable sharing.';
      shareStatus.className = 'share-status error';
    }
    return;
  }
  const now = Date.now();
  if (now - lastShareAt < 15000) {
    if (shareStatus) {
      shareStatus.textContent = 'Please wait a few seconds between shares.';
      shareStatus.className = 'share-status error';
    }
    return;
  }
  if (shareStatus) {
    shareStatus.textContent = 'Sharing…';
    shareStatus.className = 'share-status';
  }
  if (btnShare) btnShare.disabled = true;
  try {
    const stats = getCurrentStatsForShare();
    const client = getSupabase();
    const { error } = await client.from(STATS_TABLE).insert({
      period: stats.period,
      count: stats.count,
      avg_per_day: stats.avg_per_day,
      anonymous_id: getOrCreateAnonId()
    });
    if (error) {
      console.error('SlipUp: share stats failed', { table: STATS_TABLE, error });
      throw error;
    }
    lastShareAt = Date.now();
    if (shareStatus) {
      shareStatus.textContent = 'Shared anonymously.';
      shareStatus.className = 'share-status success';
      setTimeout(() => { shareStatus.textContent = ''; }, 3000);
    }
    fetchSharedStats();
  } catch (err) {
    const raw = (err && (err.message || err.error_description || err.msg)) || (typeof err === 'string' ? err : '');
    const msg = typeof raw === 'string' ? raw : (raw && raw.message) || 'Unknown error';
    const isUnregisteredKey = /unregistered\s*api\s*key/i.test(msg);
    console.error('SlipUp: share failed', { table: STATS_TABLE, err });
    if (shareStatus) {
      shareStatus.textContent = 'Failed: ' + (isUnregisteredKey ? 'Unregistered API key' : msg);
      shareStatus.className = 'share-status error';
    }
  } finally {
    if (btnShare) btnShare.disabled = false;
  }
}

function quickAdd(type) {
  if (isAtLimit()) return;
  const scope = type === 'observed' ? 'observed' : 'personal';
  const entry = { at: Date.now(), note: '', type, scope };
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  updateUpgradeUI();
  renderStats();
  renderList();
  if (SHARING_ENABLED) pushEntryToShared({ note: '', type });
}

function repeatLastNote() {
  if (isAtLimit() || (!lastEntry && entries.length === 0)) return;
  const base = lastEntry || entries[entries.length - 1];
  const entry = {
    at: Date.now(),
    note: base.note || '',
    type: base.type || 'avoidable',
    scope: normalizeScope(base)
  };
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  updateUpgradeUI();
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
  if (communityError) {
    communityError.classList.add('hidden');
    communityError.textContent = '';
  }
  const client = getSupabase();
  const MAX_OTHER_RESULTS = 10;
  const { data, error } = await client
    .from(STATS_TABLE)
    .select('id, period, count, avg_per_day, created_at, anonymous_id')
    .order('created_at', { ascending: false })
    .limit(MAX_OTHER_RESULTS);
  if (error) {
    const raw = error.message || error.error_description || error.msg || '';
    const isUnregisteredKey = /unregistered\s*api\s*key/i.test(raw);
    if (communityError) {
      communityError.textContent = 'Could not load: ' + (isUnregisteredKey ? 'Unregistered API key' : (raw || 'Unknown error'));
      communityError.classList.remove('hidden');
    }
    if (communityMetrics) communityMetrics.textContent = '';
    sharedList.innerHTML = '';
    sharedEmpty.classList.remove('hidden');
    return;
  }
  sharedEmpty.classList.toggle('hidden', (data && data.length) > 0);
  if (!data || data.length === 0) {
    sharedList.innerHTML = '';
    sharedEmpty.textContent = "No shared results yet. Share yours above!";
    if (communityMetrics) communityMetrics.textContent = '';
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
  sharedEmpty.textContent = "Set up Supabase (config.js locally or repo Secrets for deploy) to share and see others' results. See README.";
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
      .from(ENTRIES_TABLE)
      .select('id, note, type, created_at')
      .eq('mode', MODE)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    sharedEntriesList.innerHTML = '';
    const list = data || [];
    sharedEntriesEmpty.classList.toggle('hidden', list.length > 0);
    sharedEntriesEmpty.textContent = list.length === 0 ? "No shared entries yet. Add a mistake to share yours." : "";

    let avoidable = 0;
    let fertile = 0;
    let observed = 0;
    list.forEach(row => {
      const t = row.type || 'avoidable';
      if (t === 'fertile') fertile += 1;
      else if (t === 'observed') observed += 1;
      else avoidable += 1;
    });
    const primaryTotal = avoidable + fertile;
    const sharedFertilePct = primaryTotal > 0 ? Math.round((fertile / primaryTotal) * 100) : null;
    const myStats = getThisWeekAndLastWeek();
    const myPct = myStats.thisWeek.exploration;

    if (communityComparison) {
      const parts = [];
      if (myPct != null) parts.push('Your exploration this week: ' + myPct + '%.');
      if (sharedFertilePct != null) parts.push('Recent shared entries: ' + sharedFertilePct + '% fertile.');
      communityComparison.textContent = parts.length ? parts.join(' ') : '';
    }

    if (communityEntriesTrend) {
      if (!list.length) {
        communityEntriesTrend.textContent = '';
      } else {
        communityEntriesTrend.textContent =
          'Last ' + list.length + ' shared entries: ' +
          avoidable + ' avoidable · ' +
          fertile + ' fertile · ' +
          observed + ' observed.';
      }
    }

    list.forEach(row => {
      const li = document.createElement('li');
      li.className = 'entry-item';
      const badge = document.createElement('span');
      const type = row.type || 'avoidable';
      let badgeClass = 'badge-avoidable';
      let label = 'AVOIDABLE';
      if (type === 'fertile') {
        badgeClass = 'badge-fertile';
        label = 'FERTILE';
      } else if (type === 'observed') {
        badgeClass = 'badge-observed';
        label = 'OBSERVED';
      }
      badge.className = 'badge ' + badgeClass;
      badge.textContent = label;
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
    if (communityComparison) communityComparison.textContent = '';
    if (communityEntriesTrend) communityEntriesTrend.textContent = '';
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
  sharedEntriesEmpty.textContent = "Set up Supabase (config.js locally or repo Secrets for deploy) to see everyone's entries. See README.";
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
if (addNoteInput) {
  addNoteInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addMistake();
  });
  addNoteInput.addEventListener('input', updateAddButtonState);
  addNoteInput.addEventListener('paste', () => setTimeout(updateAddButtonState, 0));
}
updateAddButtonState();

if (quickAvoidableBtn) quickAvoidableBtn.addEventListener('click', () => quickAdd('avoidable'));
if (quickFertileBtn) quickFertileBtn.addEventListener('click', () => quickAdd('fertile'));
if (quickObservedBtn) quickObservedBtn.addEventListener('click', () => quickAdd('observed'));
if (repeatLastBtn) repeatLastBtn.addEventListener('click', repeatLastNote);
const btnCantTell = document.getElementById('btn-cant-tell');
if (btnCantTell) btnCantTell.addEventListener('click', () => quickAdd(getSelectedType()));

function updateTypeHint() {
  const type = getSelectedType();
  const phrase = TYPE_PHRASES[type] || TYPE_PHRASES.avoidable;
  const placeholder = TYPE_PLACEHOLDERS[type] || TYPE_PLACEHOLDERS.avoidable;
  if (typeHint) typeHint.textContent = phrase;
  if (addNoteInput) addNoteInput.placeholder = placeholder;
}

if (typeInputs && typeInputs.length) {
  typeInputs.forEach(input => {
    if (input) input.addEventListener('change', updateTypeHint);
  });
}
if (typeHint) updateTypeHint();

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
updateUpgradeUI();
renderStats();
renderList();
initSharing();
initReflection();

if (btnBuy && PAYMENT_URL) {
  btnBuy.href = PAYMENT_URL;
  btnBuy.classList.remove('hidden');
} else if (btnBuy) {
  btnBuy.classList.add('hidden');
}
if (btnBuy) {
  btnBuy.addEventListener('click', function(e) {
    if (!PAYMENT_URL) e.preventDefault();
    else setPaymentLinkClicked();
    if (PAYMENT_URL) setTimeout(updateUpgradeUI, 0);
  });
}
if (btnBuyUnlocked) {
  btnBuyUnlocked.addEventListener('click', function() {
    setPaymentLinkClicked();
    setTimeout(updateUpgradeUI, 0);
  });
}

if (btnUnlockAfterPay) {
  btnUnlockAfterPay.addEventListener('click', function() {
    setUnlocked();
  });
}

