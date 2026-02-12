// Mode: "personal" (default) or "inside" (SlipUp Inside)
const MODE = (typeof window !== 'undefined' && window.SLIPUP_MODE) || 'personal';

const STORAGE_KEY = MODE === 'inside' ? 'mistake-tracker-entries-inside' : 'mistake-tracker-entries';
const ANON_ID_KEY = MODE === 'inside' ? 'mistake-tracker-anon-id-inside' : 'mistake-tracker-anon-id';

const CONFIG = (typeof window !== 'undefined' && window.MISTAKE_TRACKER_CONFIG) || {};
// Supabase: table names (override in config with SUPABASE_STATS_TABLE / SUPABASE_ENTRIES_TABLE to use e.g. daily_summaries, shared_entries)
const STATS_TABLE = (CONFIG.SUPABASE_STATS_TABLE || '').trim() ||
  (MODE === 'inside' ? 'shared_stats_inside' : 'shared_stats');
const ENTRIES_TABLE = (CONFIG.SUPABASE_ENTRIES_TABLE || '').trim() || 'shared_what_happened';
const EVENTS_TABLE = 'slipup_events';

let entries = [];
let currentPeriod = 'day';
let currentTypeFilter = 'all';
let lastEntry = null;
let lastShareAt = 0;

// Normalize Supabase URL: trim and remove trailing slash (avoids "Invalid API key" from wrong URL format)
const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (CONFIG.SUPABASE_ANON_KEY || '').trim();
const SHARING_ENABLED = SUPABASE_URL && SUPABASE_ANON_KEY;
const FREE_ENTRY_LIMIT = 10;
const UNLOCKED_KEY = 'mistake-tracker-unlocked';
const PAYMENT_LINK_CLICKED_KEY = 'mistake-tracker-payment-link-clicked';
// Theme used when the entry was logged (calm / focus / stressed / curious / tired)
const THEME_KEY = 'mistake-tracker-theme';
// Optional extra analytics table (daily_summaries); separate from STATS_TABLE
const DAILY_SUMMARIES_TABLE = (CONFIG.SUPABASE_DAILY_SUMMARIES_TABLE || '').trim() || 'daily_summaries';
const PAYMENT_URL = (CONFIG.PAYMENT_URL || '').trim();
const PAYPAL_CLIENT_ID = (CONFIG.PAYPAL_CLIENT_ID || '').trim();
const PAYPAL_HOSTED_BUTTON_ID = (CONFIG.PAYPAL_HOSTED_BUTTON_ID || '').trim();
const PAYPAL_ENABLED = PAYPAL_CLIENT_ID && PAYPAL_HOSTED_BUTTON_ID;

const addNoteInput = document.getElementById('mistake-note');
const addBtn = document.getElementById('add-mistake');
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
const headlineStat = document.getElementById('headline-stat');
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
const firstTimeNudge = document.getElementById('first-time-nudge');
const statsNote = document.getElementById('stats-note');
const historyFilters = document.getElementById('history-filters');
const exportCsvBtn = document.getElementById('btn-export-csv');
const exportJsonBtn = document.getElementById('btn-export-json');
const lineChartWrap = document.getElementById('line-chart-wrap');
const lineChartSvg = document.getElementById('line-chart-svg');
const lineChartLegend = document.getElementById('line-chart-legend');
const lineChartEmpty = document.getElementById('line-chart-empty');
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
const btnSharedEntriesToggle = document.getElementById('btn-shared-entries-toggle');
const sharedEntriesFilters = document.getElementById('shared-entries-filters');
const communityEntriesTrend = document.getElementById('community-entries-trend');
const communityEntriesRange = document.getElementById('community-entries-range');
const reflectionAvoidable = document.getElementById('reflection-avoidable');
const reflectionFertile = document.getElementById('reflection-fertile');
const reflectionNote = document.getElementById('reflection-note');
const reflectionContextPrompt = document.getElementById('reflection-context-prompt');
const reflectionAvoidableCounter = document.getElementById('reflection-avoidable-counter');
const reflectionFertileCounter = document.getElementById('reflection-fertile-counter');
const yesterdayReflection = document.getElementById('yesterday-reflection');
const reflectionHistoryBody = document.getElementById('reflection-history-body');
const reflectionHistorySection = document.getElementById('reflection-history');
const btnExportReflections = document.getElementById('btn-export-reflections');
const communityMetrics = document.getElementById('community-metrics');
const limitMessage = document.getElementById('limit-message');
const upgradeCards = document.getElementById('upgrade-cards');
const unlockedBadge = document.getElementById('unlocked-badge');
const btnBuy = document.getElementById('btn-buy');
const paypalButtonContainer = document.getElementById('paypal-button-container');
const btnUnlockAfterPay = document.getElementById('btn-unlock-after-pay');
const btnBuyUnlocked = document.getElementById('btn-buy-unlocked');

const REFLECTIONS_KEY = MODE === 'inside' ? 'mistake-tracker-reflections-inside' : 'mistake-tracker-reflections';
const MICRO_GOAL_KEY = MODE === 'inside' ? 'mistake-tracker-micro-goal-inside' : 'mistake-tracker-micro-goal';
const REMINDER_KEY = MODE === 'inside' ? 'mistake-tracker-reminder-inside' : 'mistake-tracker-reminder';
const ADD_TO_HOME_DISMISSED_KEY = 'mistake-tracker-add-to-home-dismissed';
let paypalButtonRendered = false;

const microGoalInput = document.getElementById('micro-goal-input');
const microGoalResult = document.getElementById('micro-goal-result');
const weeklyDigest = document.getElementById('weekly-digest');
const dayVsAverage = document.getElementById('day-vs-average');
const timeOfDay = document.getElementById('time-of-day');
const topPatterns = document.getElementById('top-patterns');
const topPatternsTitle = document.getElementById('top-patterns-title');
const morePatterns = document.getElementById('more-patterns');
const btnShareImage = document.getElementById('btn-share-image');
const addToHomeBanner = document.getElementById('add-to-home-banner');
const addToHomeDismiss = document.getElementById('add-to-home-dismiss');
const reminderCheckbox = document.getElementById('reminder-checkbox');

// How many rows to fetch for "Everyone's recent entries".
// Default: last 10. Toggle button can switch to a larger slice (e.g. last 50).
let sharedEntriesLimit = 10;
let lastSharedEntries = [];
let sharedEntriesTypeFilter = 'all';
let sharedEntriesThemeFilter = 'all';

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
  if (exportCsvBtn) exportCsvBtn.disabled = !unlocked;
  if (exportJsonBtn) exportJsonBtn.disabled = !unlocked;
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

// Theme used when the entry was logged (calm / focus / stressed / curious / tired).
// Stored in localStorage under THEME_KEY and controlled by the Mood button on the page.
function getCurrentTheme() {
  try {
    const t = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) || 'calm';
    return (t === 'focus' || t === 'stressed' || t === 'curious' || t === 'tired') ? t : 'calm';
  } catch {
    return 'calm';
  }
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    entries = Array.isArray(parsed)
      ? parsed.map(e => ({
          ...e,
          scope: normalizeScope(e),
          // Normalize older theme values (e.g. "warm") into the current set.
          theme: (e.theme === 'focus' ||
                  e.theme === 'stressed' ||
                  e.theme === 'curious' ||
                  e.theme === 'tired')
            ? e.theme
            : 'calm'
        }))
      : [];
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

function getReflectionPrompt() {
  return MODE === 'inside'
    ? "At the end of the day, write one line for each: heat to cool down, and shift or support you're glad for."
    : "At the end of the day, write one line for each: an avoidable pattern to reduce, and a fertile risk you're glad you took.";
}

function renderReflection() {
  if (!reflectionAvoidable || !reflectionFertile) return;
  const key = getTodayKey();
  const all = loadReflections();
  const today = all[key] || { avoidable: '', fertile: '' };
  reflectionAvoidable.value = today.avoidable || '';
  reflectionFertile.value = today.fertile || '';

  if (reflectionContextPrompt) reflectionContextPrompt.textContent = getReflectionPrompt();
  if (reflectionNote) {
    if (!today.avoidable && !today.fertile) {
      reflectionNote.textContent = '';
    } else {
      reflectionNote.textContent = 'Saved locally for today. Tomorrow you’ll see a fresh page.';
    }
  }

  updateReflectionCounters();
  renderYesterdayReflection();
  renderReflectionHistory();
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
      reflectionNote.textContent = '';
    } else {
      reflectionNote.textContent = 'Saved locally for today. Tomorrow you’ll see a fresh page.';
    }
  }
  renderReflectionHistory();
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
  const aLab = MODE === 'inside' ? 'Heat' : 'Avoidable';
  const fLab = MODE === 'inside' ? 'Shift & Support' : 'Fertile';
  let text = 'Yesterday — ';
  if (y.avoidable) {
    text += aLab + ': ' + y.avoidable;
  }
  if (y.fertile) {
    if (y.avoidable) text += ' · ';
    text += fLab + ': ' + y.fertile;
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

function renderReflectionHistory() {
  if (!reflectionHistoryBody || !reflectionHistorySection) return;
  const all = loadReflections();
  const keys = Object.keys(all)
    .map(function (k) { return Number(k); })
    .filter(function (n) { return !isNaN(n); })
    .sort(function (a, b) { return b - a; });

  reflectionHistoryBody.innerHTML = '';

  // Only show rows that actually have some text, up to the last 7 days with content.
  var shown = 0;
  for (var i = 0; i < keys.length && shown < 7; i++) {
    var ts = keys[i];
    var day = all[String(ts)] || {};
    if (!day.avoidable && !day.fertile) continue;
    shown++;
    var d = new Date(ts);
    var dayLabel = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    var tr = document.createElement('tr');
    var tdDay = document.createElement('td');
    tdDay.textContent = dayLabel;
    var tdAvoid = document.createElement('td');
    tdAvoid.textContent = day.avoidable || '—';
    var tdFertile = document.createElement('td');
    tdFertile.textContent = day.fertile || '—';
    tr.appendChild(tdDay);
    tr.appendChild(tdAvoid);
    tr.appendChild(tdFertile);
    reflectionHistoryBody.appendChild(tr);
  }

  if (shown === 0) {
    reflectionHistorySection.classList.add('hidden');
  } else {
    reflectionHistorySection.classList.remove('hidden');
  }
}

function exportReflectionsCsv() {
  const all = loadReflections();
  const keys = Object.keys(all)
    .map(function (k) { return Number(k); })
    .filter(function (n) { return !isNaN(n); })
    .sort(function (a, b) { return a - b; }); // oldest first
  const rows = [];
  const header = MODE === 'inside'
    ? ['date', 'heat_or_avoidable', 'shift_support_or_fertile']
    : ['date', 'avoidable', 'fertile'];
  rows.push(header);
  keys.forEach(function (ts) {
    const day = all[String(ts)] || {};
    if (!day.avoidable && !day.fertile) return;
    const d = new Date(ts);
    const iso = d.toISOString().slice(0, 10);
    rows.push([iso, day.avoidable || '', day.fertile || '']);
  });
  if (rows.length === 1) return;

  const csv = rows.map(function (cols) {
    return cols.map(function (c) {
      const v = c == null ? '' : String(c);
      if (/[",\n]/.test(v)) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(',');
  }).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const prefix = MODE === 'inside' ? 'slipup-inside-reflections-' : 'slipup-reflections-';
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = prefix + today + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const noun = MODE === 'inside' ? 'moments' : 'mistakes';
  if (period === 'day') return noun + ' today';
  if (period === 'week') return noun + ' this week';
  return noun + ' this month';
}

function renderStats() {
  const filtered = filterByPeriod(currentPeriod);
  const count = filtered.length;
  const days = getDaysInPeriod(currentPeriod);
  const avg = days > 0 ? (count / days).toFixed(1) : '—';

  const avoidableCount = filtered.filter(e => (e.type || 'avoidable') === 'avoidable').length;
  const fertileCount = filtered.filter(e => (e.type || 'avoidable') === 'fertile').length;
  const observedCount = filtered.filter(e => e.type === 'observed').length;
  // Track top mood theme based on the current 5-mode set.
  const byTheme = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };
  filtered.forEach(e => {
    const raw = e.theme || 'calm';
    const t = (raw === 'focus' || raw === 'stressed' || raw === 'curious' || raw === 'tired') ? raw : 'calm';
    if (byTheme[t] != null) byTheme[t] += 1;
  });
  let topTheme = null;
  let topThemeCount = 0;
  Object.keys(byTheme).forEach(key => {
    if (byTheme[key] > topThemeCount) {
      topTheme = key;
      topThemeCount = byTheme[key];
    }
  });

  if (statCount) {
    const prev = statCount.textContent;
    statCount.textContent = count;
    if (prev !== String(count)) {
      statCount.classList.add('updated');
      setTimeout(function () { statCount.classList.remove('updated'); }, 450);
    }
  }
  if (statLabel) statLabel.textContent = getPeriodLabel(currentPeriod);
  if (statAvg) statAvg.textContent = avg;

  const labels = MODE === 'inside'
    ? { avoidable: 'heat', fertile: 'shift', observed: 'support' }
    : { avoidable: 'avoidable', fertile: 'fertile', observed: 'observed' };
  const reduceHint = MODE === 'inside' ? 'to cool down' : 'to reduce';
  const fertileHint = MODE === 'inside' ? 'stretches' : 'experiments';

  if (statsBreakdown) {
    if (count === 0) {
      statsBreakdown.textContent = '';
    } else {
      const parts = [];
      if (avoidableCount) parts.push(avoidableCount + ' ' + labels.avoidable);
      if (fertileCount) parts.push(fertileCount + ' ' + labels.fertile);
      if (observedCount) parts.push(observedCount + ' ' + labels.observed);
      statsBreakdown.textContent = parts.join(' · ');
    }
  }

  if (statsNote) {
    if (count === 0) {
      statsNote.textContent = MODE === 'inside'
        ? "No moments yet this period. Add one when you're ready."
        : "No mistakes logged yet. That's fine — add one when something comes up.";
    } else {
      const parts = [];
      if (avoidableCount > 0) {
        parts.push(avoidableCount + ' ' + labels.avoidable + ' ' + reduceHint);
      }
      if (fertileCount > 0) {
        parts.push(fertileCount + ' ' + labels.fertile + ' ' + fertileHint);
      }
      if (avoidableCount === 0 && fertileCount === 0 && observedCount > 0) {
        parts.push(observedCount + ' ' + labels.observed + ' noticed');
      }
      if (topTheme && topThemeCount > 0) {
        const themeLabels = { calm: 'calm', focus: 'focused', stressed: 'stressed', curious: 'curious', tired: 'tired' };
        const themeLabel = themeLabels[topTheme] || topTheme;
        parts.push('mostly ' + themeLabel + ' when logging');
      }
      statsNote.textContent = parts.join(' · ');
    }
  }

  if (streakNote) {
    const streak = getCurrentStreak();
    if (streak <= 0) {
      streakNote.textContent = '';
    } else if (streak === 1) {
      streakNote.textContent = MODE === 'inside'
        ? "1 day in a row — nice start."
        : "1 day in a row — nice start.";
    } else if (streak < 7) {
      streakNote.textContent = streak + " days in a row — keep it going.";
    } else {
      streakNote.textContent = streak + "-day streak — you're building a habit.";
    }
  }

  if (headlineStat) {
    const primaryTotal = avoidableCount + fertileCount;
    if (primaryTotal === 0) {
      headlineStat.textContent = '';
      headlineStat.classList.add('hidden');
    } else {
      headlineStat.textContent = getExplorationSoWhat(Math.round((fertileCount / primaryTotal) * 100));
      headlineStat.classList.remove('hidden');
    }
  }

  // Exploration index: fertile ÷ (avoidable + fertile)
  if (statExploration) {
    const primaryTotal = avoidableCount + fertileCount;
    if (primaryTotal === 0) {
      statExploration.textContent = '—';
      if (statExplorationHint) statExplorationHint.textContent = MODE === 'inside' ? 'shift ÷ (heat + shift)' : 'fertile ÷ (avoidable + fertile)';
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = '';
    } else {
      const ratio = fertileCount / primaryTotal;
      const pct = Math.round(ratio * 100);
      statExploration.textContent = pct + '%';
      if (statExplorationHint) statExplorationHint.textContent = MODE === 'inside'
        ? fertileCount + ' shift ÷ ' + primaryTotal + ' (heat + shift)'
        : fertileCount + ' fertile ÷ ' + primaryTotal + ' (avoidable + fertile)';
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = getExplorationSoWhat(pct);
    }
  }
  renderTrends();
  renderLineChart();
  renderProgress();
  renderAutoReflection();
  renderMicroGoal();
  renderInsights();
}

function getExplorationSoWhat(pct) {
  if (MODE === 'inside') {
    if (pct >= 70) return 'Lots of shifts.';
    if (pct >= 50) return 'Good balance of heat and shift.';
    if (pct >= 30) return 'Room for more shifts.';
    if (pct >= 10) return 'Aim for more shifts.';
    if (pct > 0) return 'One small shift can help.';
    return 'Try one stretch today.';
  }
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
    const theme = document.createElement('span');
    theme.className = 'theme';
    const t = entry.theme || 'calm';
    let themeLabel = 'CALM';
    if (t === 'focus') themeLabel = 'FOCUS';
    else if (t === 'stressed') themeLabel = 'STRESSED';
    else if (t === 'curious') themeLabel = 'CURIOUS';
    else if (t === 'tired') themeLabel = 'TIRED';
    // Older value from earlier versions; map to CURIOUS for continuity.
    else if (t === 'warm') themeLabel = 'CURIOUS';
    theme.textContent = themeLabel;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(entry.at);
    li.appendChild(badge);
    li.appendChild(note);
    li.appendChild(theme);
    li.appendChild(time);
    entryList.appendChild(li);
  });

  if (emptyState) emptyState.classList.toggle('hidden', show.length > 0);
  if (firstTimeNudge) firstTimeNudge.classList.toggle('hidden', entries.length > 0);
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
    return { total: list.length, fertile, avoidable, observed, exploration };
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
    totalEl.textContent = stats.total + ' ' + (MODE === 'inside' ? 'moments' : 'mistakes');
    card.appendChild(totalEl);
    const explEl = document.createElement('span');
    explEl.className = 'progress-card-exploration';
    explEl.textContent = stats.exploration != null ? stats.exploration + '% ' + (MODE === 'inside' ? 'shift' : 'exploration') : '—';
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
  else if (thisWeek.total === 0 && lastWeek.total > 0) diffText = MODE === 'inside' ? 'No moments this week yet.' : 'No mistakes logged this week yet.';
  else if (totalDiff !== 0 || (explDiff !== null && explDiff !== 0)) {
    const parts = [];
    const noun = MODE === 'inside' ? 'moments' : 'mistakes';
    if (totalDiff < 0) parts.push('Fewer ' + noun + ' than last week.');
    else if (totalDiff > 0) parts.push('More ' + noun + ' than last week.');
    if (explDiff !== null && explDiff > 0) parts.push(MODE === 'inside' ? 'Higher shift—more stretches.' : 'Higher exploration—more fertile.');
    else if (explDiff !== null && explDiff < 0) parts.push(MODE === 'inside' ? 'Lower shift than last week.' : 'Lower exploration than last week.');
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

function getDayCountsForChart(n) {
  const now = Date.now();
  const dayMs = 86400000;
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const dayStart = getStartOfDay(now - i * dayMs);
    const dayEnd = dayStart + dayMs;
    const dayEntries = entries.filter(e => e.at >= dayStart && e.at < dayEnd);
    const avoidable = dayEntries.filter(e => (e.type || 'avoidable') === 'avoidable').length;
    const fertile = dayEntries.filter(e => (e.type || 'avoidable') === 'fertile').length;
    const observed = dayEntries.filter(e => e.type === 'observed').length;
    result.push({
      dayStart,
      avoidable,
      fertile,
      observed,
      total: avoidable + fertile + observed
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
    const aLabel = MODE === 'inside' ? 'heat' : 'avoidable';
    const fLabel = MODE === 'inside' ? 'shift' : 'fertile';
    barA.className = 'trends-bar trends-bar-avoidable';
    barA.style.height = avoidableH + '%';
    barA.title = d.avoidable + ' ' + aLabel;
    bars.appendChild(barA);
    const barF = document.createElement('div');
    barF.className = 'trends-bar trends-bar-fertile';
    barF.style.height = fertileH + '%';
    barF.title = d.fertile + ' ' + fLabel;
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
      trendsHighlight.textContent = MODE === 'inside'
        ? 'Best shift day (last 7): ' + label + ' at ' + pct + '%.'
        : 'Best exploration day (last 7): ' + label + ' at ' + pct + '%.';
    }
  }
}

function renderLineChart() {
  if (!lineChartWrap || !lineChartSvg || !lineChartLegend || !lineChartEmpty) return;
  const days = getDayCountsForChart(14);
  const hasAny = days.some(d => d.total > 0);
  lineChartEmpty.classList.toggle('hidden', hasAny);
  lineChartWrap.classList.toggle('hidden', !hasAny);
  if (!hasAny) {
    lineChartSvg.innerHTML = '';
    lineChartLegend.innerHTML = '';
    return;
  }
  const pad = { top: 10, right: 10, bottom: 25, left: 35 };
  const w = 400;
  const h = 180;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...days.map(d => Math.max(d.avoidable, d.fertile, d.observed, 1)));
  const scaleY = (v) => pad.top + chartH - (v / maxVal) * chartH;
  const scaleX = (i) => pad.left + (i / (days.length - 1 || 1)) * chartW;

  const pts = (key) =>
    days
      .map((d, i) => scaleX(i) + ',' + scaleY(d[key]))
      .join(' ');

  const avoidableColor = '#e04e5a';
  const fertileColor = '#4a9c6d';
  const observedColor = '#5a8ed6';

  lineChartSvg.innerHTML =
    '<polyline fill="none" stroke="' +
    avoidableColor +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' +
    pts('avoidable') +
    '"></polyline>' +
    '<polyline fill="none" stroke="' +
    fertileColor +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' +
    pts('fertile') +
    '"></polyline>' +
    '<polyline fill="none" stroke="' +
    observedColor +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' +
    pts('observed') +
    '"></polyline>';

  const labels =
    MODE === 'inside'
      ? { avoidable: 'Heat', fertile: 'Shift', observed: 'Support' }
      : { avoidable: 'Avoidable', fertile: 'Fertile', observed: 'Observed' };
  lineChartLegend.innerHTML =
    '<span class="legend-item"><span class="legend-swatch" style="background:' +
    avoidableColor +
    '"></span><span class="legend-label">' +
    labels.avoidable +
    '</span></span>' +
    '<span class="legend-item"><span class="legend-swatch" style="background:' +
    fertileColor +
    '"></span><span class="legend-label">' +
    labels.fertile +
    '</span></span>' +
    '<span class="legend-item"><span class="legend-swatch" style="background:' +
    observedColor +
    '"></span><span class="legend-label">' +
    labels.observed +
    '</span></span>';
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
  let text;
  if (total === 1) {
    text = fertile ? pick(AUTO_REFLECTION_PHRASES.oneFertile) : pick(AUTO_REFLECTION_PHRASES.oneAvoidable);
  } else if (ratio >= 0.6) {
    text = pick(AUTO_REFLECTION_PHRASES.highFertile).replace(/\{f\}/g, f).replace(/\{a\}/g, a);
  } else if (ratio >= 0.4) {
    text = pick(AUTO_REFLECTION_PHRASES.mixed).replace(/\{a\}/g, a).replace(/\{f\}/g, f);
  } else if (ratio > 0) {
    text = pick(AUTO_REFLECTION_PHRASES.lowFertile).replace(/\{a\}/g, a).replace(/\{f\}/g, f);
  } else {
    text = pick(AUTO_REFLECTION_PHRASES.allAvoidable).replace(/\{a\}/g, a);
  }
  if (MODE === 'inside') {
    text = text.replace(/\bavoidable\b/gi, 'heat').replace(/\bfertile\b/gi, 'shift')
      .replace(/\bmistake(s?)\b/gi, 'moment$1').replace(/\bslip-up(s?)\b/gi, 'heat$1')
      .replace(/\bexperiment(s?)\b/gi, 'stretch$1');
  }
  return text;
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

function loadMicroGoal() {
  try {
    const key = getTodayKey();
    const raw = localStorage.getItem(MICRO_GOAL_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data[key] || '';
  } catch {
    return '';
  }
}

function saveMicroGoal(value) {
  try {
    const key = getTodayKey();
    const raw = localStorage.getItem(MICRO_GOAL_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[key] = (value || '').trim();
    localStorage.setItem(MICRO_GOAL_KEY, JSON.stringify(data));
  } catch (_) {}
}

function renderMicroGoal() {
  if (!microGoalInput || !microGoalResult) return;
  microGoalInput.value = loadMicroGoal();
  const goal = (microGoalInput.value || '').trim();
  if (!goal) {
    microGoalResult.textContent = '';
    return;
  }
  const todayStart = getStartOfDay(Date.now());
  const todayEnd = todayStart + 86400000;
  const todayEntries = entries.filter(e => e.at >= todayStart && e.at < todayEnd);
  const avoidable = todayEntries.filter(e => (e.type || 'avoidable') === 'avoidable').length;
  const fertile = todayEntries.filter(e => (e.type || 'avoidable') === 'fertile').length;
  const aLabel = MODE === 'inside' ? 'heat' : 'avoidable';
  const fLabel = MODE === 'inside' ? 'shift' : 'fertile';
  let result = 'Today: ' + avoidable + ' ' + aLabel + ', ' + fertile + ' ' + fLabel + '.';
  const lower = goal.toLowerCase();
  const underMatch = lower.match(/(?:under|less than|below)\s*(\d+)/) || lower.match(/(\d+)\s*(?:or\s*)?(?:fewer|less)/);
  if (underMatch) {
    const cap = parseInt(underMatch[1], 10);
    if (avoidable <= cap) {
      result += ' You aimed to keep ' + aLabel + ' under ' + cap + ' — on track.';
    } else {
      result += ' You aimed for under ' + cap + ' ' + aLabel + ' — over by ' + (avoidable - cap) + '.';
    }
  } else if (/\b(?:one|1)\s*fertile/.test(lower) || /\b(?:one|1)\s*shift/.test(lower) || /fertile\s*(?:experiment|risk)/.test(lower) || /shift\s*(?:experiment)?/.test(lower)) {
    if (fertile >= 1) {
      result += ' You aimed for at least one ' + fLabel + ' — done.';
    } else {
      result += ' You aimed for a ' + fLabel + ' — not yet.';
    }
  } else {
    result += ' Goal: ' + goal;
  }
  microGoalResult.textContent = result;
}

function renderInsights() {
  const aLabel = MODE === 'inside' ? 'heat' : 'avoidable';
  const fLabel = MODE === 'inside' ? 'shift' : 'fertile';
  const oLabel = MODE === 'inside' ? 'support' : 'observed';

  if (weeklyDigest) {
    const { thisWeek } = getThisWeekAndLastWeek();
    if (thisWeek.total === 0) {
      weeklyDigest.textContent = 'No entries this week yet.';
    } else {
      const parts = [];
      if (thisWeek.avoidable) parts.push(thisWeek.avoidable + ' ' + aLabel);
      if (thisWeek.fertile) parts.push(thisWeek.fertile + ' ' + fLabel);
      if (thisWeek.observed) parts.push(thisWeek.observed + ' ' + oLabel);
      let sent = 'This week: ' + parts.join(', ') + '.';
      if (thisWeek.exploration != null) {
        sent += ' ' + thisWeek.exploration + '% ' + (MODE === 'inside' ? 'shift' : 'exploration') + '.';
      }
      weeklyDigest.textContent = sent;
    }
  }

  if (dayVsAverage) {
    const todayStart = getStartOfDay(Date.now());
    const todayEnd = todayStart + 86400000;
    const todayEntries = entries.filter(e => e.at >= todayStart && e.at < todayEnd);
    const todayCount = todayEntries.length;
    const last7 = getDayCountsLastN(7);
    const total7 = last7.reduce((s, d) => s + d.total, 0);
    const avgPerDay = total7 > 0 ? (total7 / 7).toFixed(1) : 0;
    if (todayCount === 0 && total7 === 0) {
      dayVsAverage.textContent = 'No entries yet.';
    } else if (total7 === 0) {
      dayVsAverage.textContent = 'Today: ' + todayCount + '. Your first day of logging.';
    } else {
      const diff = todayCount - parseFloat(avgPerDay);
      if (Math.abs(diff) < 0.5) {
        dayVsAverage.textContent = 'Today: ' + todayCount + '. About average (' + avgPerDay + ' per day lately).';
      } else if (diff > 0) {
        dayVsAverage.textContent = 'Today: ' + todayCount + '. Above your recent average (' + avgPerDay + ' per day).';
      } else {
        dayVsAverage.textContent = 'Today: ' + todayCount + '. Below your recent average (' + avgPerDay + ' per day).';
      }
    }
  }

  if (timeOfDay) {
    if (entries.length === 0) {
      timeOfDay.textContent = 'No entries yet.';
    } else {
      const hours = entries.map(e => new Date(e.at).getHours());
      const morning = hours.filter(h => h >= 5 && h < 12).length;
      const afternoon = hours.filter(h => h >= 12 && h < 17).length;
      const evening = hours.filter(h => h >= 17 || h < 2).length;
      const max = Math.max(morning, afternoon, evening);
      if (max === 0) {
        timeOfDay.textContent = 'You log across the day.';
      } else if (morning === max) {
        timeOfDay.textContent = 'You mostly log in the morning.';
      } else if (afternoon === max) {
        timeOfDay.textContent = 'You mostly log in the afternoon.';
      } else {
        timeOfDay.textContent = 'You mostly log in the evening.';
      }
    }
  }

  if (topPatterns && topPatternsTitle) {
    const noteCounts = {};
    entries.forEach(e => {
      const n = (e.note || '').trim().toLowerCase();
      if (n.length >= 3) {
        noteCounts[n] = (noteCounts[n] || 0) + 1;
      }
    });
    const sorted = Object.entries(noteCounts)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (sorted.length === 0) {
      topPatternsTitle.textContent = '';
      topPatterns.innerHTML = '';
    } else {
      topPatternsTitle.textContent = 'Notes you repeat:';
      topPatterns.innerHTML = '';
      sorted.forEach(([note, count]) => {
        const li = document.createElement('li');
        li.className = 'entry-item';
        li.innerHTML = '<span class="note">' + escapeHtml(note) + '</span><span class="time">' + count + '×</span>';
        topPatterns.appendChild(li);
      });
    }
  }

  if (morePatterns) {
    const themes = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };
    entries.forEach(e => {
      const t = (e.theme === 'focus' || e.theme === 'stressed' || e.theme === 'curious' || e.theme === 'tired') ? e.theme : 'calm';
      themes[t] = (themes[t] || 0) + 1;
    });
    const chips = Object.entries(themes)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme, c]) => '<span class="insight-chip">' + theme + ' (' + c + ')</span>')
      .join('');
    morePatterns.innerHTML = chips || '<span class="insight-chip">No patterns yet</span>';
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function shareAsImage() {
  const statCountEl = document.getElementById('stat-count');
  const statLabelEl = document.getElementById('stat-label');
  const statAvgEl = document.getElementById('stat-avg');
  const statExplorationEl = document.getElementById('stat-exploration');
  if (!statCountEl || !statLabelEl) return;
  const w = 340;
  const h = 200;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f0f12';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e4e4e7';
  ctx.font = 'bold 28px DM Sans, sans-serif';
  ctx.fillText('SlipUp', 20, 40);
  ctx.font = '14px DM Sans, sans-serif';
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(statCountEl.textContent + ' ' + (statLabelEl.textContent || ''), 20, 70);
  if (statAvgEl) ctx.fillText('Avg ' + statAvgEl.textContent + '/day', 20, 92);
  if (statExplorationEl && statExplorationEl.textContent !== '—') {
    ctx.fillText(statExplorationEl.textContent + ' ' + (MODE === 'inside' ? 'shift' : 'exploration'), 20, 114);
  }
  ctx.fillStyle = '#71717a';
  ctx.font = '11px DM Sans, sans-serif';
  ctx.fillText('slipup.io', 20, h - 15);
  canvas.toBlob(function(blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slipup-stats-' + new Date().toISOString().slice(0, 10) + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
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
  const entry = { at: Date.now(), note, type, scope, theme: getCurrentTheme() };
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
      theme: entry.theme || getCurrentTheme(),
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
    const filtered = filterByPeriod(currentPeriod);
    const avoidableCount = filtered.filter(e => (e.type || 'avoidable') === 'avoidable').length;
    const fertileCount = filtered.filter(e => (e.type || 'avoidable') === 'fertile').length;
    const observedCount = filtered.filter(e => e.type === 'observed').length;
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
    // Also log a daily summary row if configured
    if (DAILY_SUMMARIES_TABLE) {
      try {
        const today = new Date();
        const day = today.toISOString().slice(0, 10); // YYYY-MM-DD
        const primaryTotal = avoidableCount + fertileCount;
        const exploration_pct = primaryTotal > 0 ? Math.round((fertileCount / primaryTotal) * 100) : null;
        await client.from(DAILY_SUMMARIES_TABLE).insert({
          anonymous_id: getOrCreateAnonId(),
          mode: MODE,
          day,
          avoidable_count: avoidableCount,
          fertile_count: fertileCount,
          observed_count: observedCount,
          exploration_pct,
          first_at: null,
          last_at: null
        });
      } catch (err) {
        console.warn('SlipUp: daily_summaries insert failed', { table: DAILY_SUMMARIES_TABLE, err });
      }
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
  const entry = { at: Date.now(), note: '', type, scope, theme: getCurrentTheme() };
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  updateUpgradeUI();
  renderStats();
  renderList();
  if (SHARING_ENABLED) pushEntryToShared({ note: '', type, theme: entry.theme });
}

function repeatLastNote() {
  if (isAtLimit() || (!lastEntry && entries.length === 0)) return;
  const base = lastEntry || entries[entries.length - 1];
  const entry = {
    at: Date.now(),
    note: base.note || '',
    type: base.type || 'avoidable',
    scope: normalizeScope(base),
    theme: getCurrentTheme()
  };
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  updateUpgradeUI();
  renderStats();
  renderList();
  if (SHARING_ENABLED) pushEntryToShared({ note: entry.note, type: entry.type, theme: entry.theme });
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
  a.download = MODE === 'inside' ? 'slipup-inside-mistakes.csv' : 'mistakes.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportJson() {
  const data = {
    exportedAt: new Date().toISOString(),
    mode: MODE,
    entries: entries.map(e => ({
      at: e.at,
      type: e.type || 'avoidable',
      note: e.note || '',
      theme: e.theme || 'calm'
    }))
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = MODE === 'inside' ? 'slipup-inside-backup.json' : 'slipup-backup.json';
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
    sharedEmpty.textContent = MODE === 'inside'
      ? "No shared results yet. Share your period above!"
      : "No shared results yet. Share yours above!";
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
      .select('id, note, type, theme, created_at')
      .eq('mode', MODE)
      .order('created_at', { ascending: false })
      .limit(sharedEntriesLimit);
    if (error) throw error;
    sharedEntriesList.innerHTML = '';
    const list = data || [];
    lastSharedEntries = list;
    if (communityEntriesRange) {
      const label = sharedEntriesLimit === 10 ? 'last 10' : 'last 50';
      const noun = MODE === 'inside' ? 'shared moments' : 'shared entries';
      communityEntriesRange.textContent = 'Showing ' + label + ' ' + noun + ' (most recent first).';
    }
    sharedEntriesEmpty.classList.toggle('hidden', list.length > 0);
    sharedEntriesEmpty.textContent = list.length === 0
      ? (MODE === 'inside' ? "No shared moments yet. Add one to share yours." : "No shared entries yet. Add a mistake to share yours.")
      : "";

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
      if (myPct != null) parts.push(MODE === 'inside' ? 'Your shift this week: ' + myPct + '%.' : 'Your exploration this week: ' + myPct + '%.');
      if (sharedFertilePct != null) parts.push(MODE === 'inside' ? 'Recent shared moments: ' + sharedFertilePct + '% shift.' : 'Recent shared entries: ' + sharedFertilePct + '% fertile.');
      communityComparison.textContent = parts.length ? parts.join(' ') : '';
    }

    if (communityEntriesTrend) {
      if (!list.length) {
        communityEntriesTrend.textContent = '';
      } else {
        const al = MODE === 'inside' ? 'heat' : 'avoidable';
        const fl = MODE === 'inside' ? 'shift' : 'fertile';
        const ol = MODE === 'inside' ? 'support' : 'observed';
        communityEntriesTrend.textContent =
          'Last ' + list.length + ' shared ' + (MODE === 'inside' ? 'moments' : 'entries') + ': ' +
          avoidable + ' ' + al + ' · ' +
          fertile + ' ' + fl + ' · ' +
          observed + ' ' + ol + '.';
      }
    }

    renderSharedEntriesList();
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

function renderSharedEntriesList() {
  if (!sharedEntriesList) return;
  sharedEntriesList.innerHTML = '';
  const source = Array.isArray(lastSharedEntries) ? lastSharedEntries : [];
  const filtered = source.filter(row => {
    const type = (row.type || 'avoidable');
    const themeRaw = (row.theme || 'calm');
    const theme = (themeRaw === 'focus' || themeRaw === 'stressed' || themeRaw === 'curious' || themeRaw === 'tired')
      ? themeRaw
      : 'calm';
    const typeOk = sharedEntriesTypeFilter === 'all' || type === sharedEntriesTypeFilter;
    const themeOk = sharedEntriesThemeFilter === 'all' || theme === sharedEntriesThemeFilter;
    return typeOk && themeOk;
  });

  if (!filtered.length) {
    if (sharedEntriesEmpty) {
      sharedEntriesEmpty.textContent = 'No shared entries match these filters.';
      sharedEntriesEmpty.classList.remove('hidden');
    }
    return;
  }

  if (sharedEntriesEmpty && source.length > 0) {
    sharedEntriesEmpty.classList.add('hidden');
  }

  filtered.forEach(row => {
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
    const theme = document.createElement('span');
    theme.className = 'theme';
    const tRaw = row.theme || 'calm';
    const t = (tRaw === 'focus' || tRaw === 'stressed' || tRaw === 'curious' || tRaw === 'tired') ? tRaw : 'calm';
    let themeLabel = 'CALM';
    if (t === 'focus') themeLabel = 'FOCUS';
    else if (t === 'stressed') themeLabel = 'STRESSED';
    else if (t === 'curious') themeLabel = 'CURIOUS';
    else if (t === 'tired') themeLabel = 'TIRED';
    theme.textContent = themeLabel;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTimeFromISO(row.created_at);
    li.appendChild(badge);
    li.appendChild(note);
    li.appendChild(theme);
    li.appendChild(time);
    sharedEntriesList.appendChild(li);
  });
}

function toggleSharedEntriesView() {
  if (!btnSharedEntriesToggle) return;
  // Switch between a short recent slice and a larger window.
  if (sharedEntriesLimit === 10) {
    sharedEntriesLimit = 50;
    btnSharedEntriesToggle.textContent = 'Show recent (last 10)';
  } else {
    sharedEntriesLimit = 10;
    btnSharedEntriesToggle.textContent = 'Show more (last 50)';
  }
  fetchSharedEntries();
}

function handleSharedEntriesFilterClick(e) {
  if (!sharedEntriesFilters) return;
  const target = e.target.closest('button.filter-chip');
  if (!target || !sharedEntriesFilters.contains(target)) return;

  if (target.hasAttribute('data-filter-type')) {
    const value = target.getAttribute('data-filter-type') || 'all';
    sharedEntriesTypeFilter = value;
    const typeButtons = sharedEntriesFilters.querySelectorAll('button[data-filter-type]');
    typeButtons.forEach(btn => {
      btn.classList.toggle('active', btn === target);
    });
  } else if (target.hasAttribute('data-filter-theme')) {
    const value = target.getAttribute('data-filter-theme') || 'all';
    sharedEntriesThemeFilter = value;
    const themeButtons = sharedEntriesFilters.querySelectorAll('button[data-filter-theme]');
    themeButtons.forEach(btn => {
      btn.classList.toggle('active', btn === target);
    });
  }

  renderSharedEntriesList();
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
    if (btnSharedEntriesToggle) btnSharedEntriesToggle.addEventListener('click', toggleSharedEntriesView);
     if (sharedEntriesFilters) sharedEntriesFilters.addEventListener('click', handleSharedEntriesFilterClick);
    // Start with the recent slice (last 10).
    sharedEntriesLimit = 10;
    if (btnSharedEntriesToggle) btnSharedEntriesToggle.textContent = 'Show more (last 50)';
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

function initMicroGoal() {
  if (!microGoalInput) return;
  microGoalInput.addEventListener('blur', () => {
    saveMicroGoal(microGoalInput.value);
    renderMicroGoal();
  });
  microGoalInput.addEventListener('input', () => renderMicroGoal());
}

function initAddToHomeBanner() {
  if (!addToHomeBanner || !addToHomeDismiss) return;
  if (localStorage.getItem(ADD_TO_HOME_DISMISSED_KEY) === 'true') return;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) return;
  const showBanner = () => {
    addToHomeBanner.classList.remove('hidden');
  };
  if ('beforeinstallprompt' in window) {
    window.addEventListener('beforeinstallprompt', showBanner, { once: true });
  } else {
    const isPWA = document.querySelector('link[rel="manifest"]') && 'serviceWorker' in navigator;
    if (isPWA) setTimeout(showBanner, 2000);
  }
  addToHomeDismiss.addEventListener('click', () => {
    addToHomeBanner.classList.add('hidden');
    try { localStorage.setItem(ADD_TO_HOME_DISMISSED_KEY, 'true'); } catch (_) {}
  });
}

function initReminder() {
  if (!reminderCheckbox) return;
  try {
    reminderCheckbox.checked = localStorage.getItem(REMINDER_KEY) === 'true';
  } catch (_) {}
  reminderCheckbox.addEventListener('change', () => {
    const enabled = reminderCheckbox.checked;
    try { localStorage.setItem(REMINDER_KEY, enabled ? 'true' : 'false'); } catch (_) {}
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if (enabled && 'Notification' in window && Notification.permission === 'granted') {
      scheduleReminder();
    }
  });
  if (reminderCheckbox.checked && 'Notification' in window && Notification.permission === 'granted') {
    scheduleReminder();
  }
}

function scheduleReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const target = new Date(now);
  target.setHours(20, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const ms = target - now;
  setTimeout(() => {
    if (localStorage.getItem(REMINDER_KEY) !== 'true') return;
    new Notification('SlipUp', { body: 'Time for your evening check-in. How did today go?' });
    scheduleReminder();
  }, ms);
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

if (btnExportReflections) {
  btnExportReflections.addEventListener('click', exportReflectionsCsv);
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => { if (isUnlocked()) exportCsv(); });
}
if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', () => { if (isUnlocked()) exportJson(); });
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
initMicroGoal();
initAddToHomeBanner();
initReminder();
if (btnShareImage) btnShareImage.addEventListener('click', shareAsImage);

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

