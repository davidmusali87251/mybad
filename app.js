// Mode: "personal" (default) or "inside" (SlipUp Inside)
const MODE = (typeof window !== 'undefined' && window.SLIPUP_MODE) || 'personal';

const STORAGE_KEY = MODE === 'inside' ? 'mistake-tracker-entries-inside' : 'mistake-tracker-entries';
const ANON_ID_KEY = MODE === 'inside' ? 'mistake-tracker-anon-id-inside' : 'mistake-tracker-anon-id';

const CONFIG = (typeof window !== 'undefined' && window.MISTAKE_TRACKER_CONFIG) || {};
// Supabase: table names (override in config with SUPABASE_STATS_TABLE / SUPABASE_ENTRIES_TABLE to use e.g. daily_summaries, shared_entries)
const STATS_TABLE = (CONFIG.SUPABASE_STATS_TABLE || '').trim() ||
  (MODE === 'inside' ? 'shared_stats_inside' : 'shared_stats');
const ENTRIES_TABLE = (CONFIG.SUPABASE_ENTRIES_TABLE || '').trim() || 'shared_what_happened';
const CHART_TABLE = (CONFIG.SUPABASE_CHART_TABLE || '').trim() || 'shared_chart_counts';
const EVENTS_TABLE = 'slipup_events';
const STREAK_REFLECTIONS_TABLE = (CONFIG.SUPABASE_STREAK_REFLECTIONS_TABLE || '').trim() || 'streak_reflections';

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

const BIAS_REFLECTIONS = {
  harm: 'This may be a useful observed mistake. Ask yourself what you can learn from it.',
  failed: 'This may be a useful observed mistake. Ask yourself what you can learn from it.',
  different: 'This might not be a mistake. It could be a difference in values, style, or perspective.',
  triggered: 'This might not be a mistake. It could be a difference in values, style, or perspective.',
  unsure: "Not every observed mistake needs a conclusion. Sometimes awareness is enough."
};
const BIAS_LABELS = { harm: 'harm', failed: 'failed', different: 'different', triggered: 'triggered', unsure: 'unsure' };

const STREAK_REFLECTION_STORAGE_KEY = MODE === 'inside' ? 'slipup-streak-reflection-inside' : 'slipup-streak-reflection';
const STREAK_REFLECTION_QUESTION = "2 days in a row — what helped you show up?";
const STREAK_REFLECTION_LINES = {
  discipline: 'This seems intentional.',
  responsibility: 'A sense of duty was present.',
  pressure: 'External force played a role.',
  curiosity: 'Interest moved the action.',
  fear: 'Fear can also move action.',
  commitment: 'Something important was at stake.',
  'not-sure': "The cause isn't always visible."
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
const statsInsightChart = document.getElementById('stats-insight-chart');
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
const sharedListChart = document.getElementById('shared-list-chart');
const communityMetricsChart = document.getElementById('community-metrics-chart');
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
const btnAddFromCommunity = document.getElementById('btn-add-from-community');
const topBarAdd = document.getElementById('top-bar-add');
const topBarSlipups = document.getElementById('top-bar-slipups');
const communityEntriesTrend = document.getElementById('community-entries-trend');
const communityEntriesRange = document.getElementById('community-entries-range');
const globalCountChart = document.getElementById('global-count-chart');
const btnSharedTotal = document.getElementById('btn-shared-total');
const biasCheckRow = document.getElementById('bias-check-row');
const btnBiasCheck = document.getElementById('btn-bias-check');
const biasCheckOverlay = document.getElementById('bias-check-overlay');
const biasCheckPanelStat = document.getElementById('bias-check-panel-stat');
const biasCheckPanelIntent = document.getElementById('bias-check-panel-intent');
const biasCheckReflection = document.getElementById('bias-check-reflection');
const biasCheckOptions = document.getElementById('bias-check-options');
const btnBiasCheckClose = document.getElementById('btn-bias-check-close');
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
const weeklyDigestChart = document.getElementById('weekly-digest-chart');
const dayVsAverage = document.getElementById('day-vs-average');
const dayVsAverageChart = document.getElementById('day-vs-average-chart');
const timeOfDay = document.getElementById('time-of-day');
const timeOfDayChart = document.getElementById('time-of-day-chart');
const topPatternsChart = document.getElementById('top-patterns-chart');
const morePatternsChart = document.getElementById('more-patterns-chart');
const biasCheckInsight = document.getElementById('bias-check-insight');
const biasCheckInsightBlock = document.getElementById('bias-check-insight-block');
const biasCheckCountBtn = document.getElementById('bias-check-count-btn');
const biasCheckCountGlobalBtn = document.getElementById('bias-check-count-global-btn');
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
/** Set when user clicks Save in Bias Check; applied to next observed entry. */
let lastBiasCheckReason = null;
/** Global observed count from shared feed (set by fetchSharedEntries). */
let lastGlobalObservedCount = 0;

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
// Prefer the Mood button's displayed value so "I can't tell" and add-mistake use the current selection.
function getCurrentTheme() {
  try {
    const btn = document.getElementById('btn-theme');
    if (btn) {
      const label = (btn.textContent || '').trim().toLowerCase();
      if (label === 'focus' || label === 'stressed' || label === 'curious' || label === 'tired') return label;
    }
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
  const observedCount = filtered.filter(e => (e.type || 'avoidable') === 'observed').length;
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
      statsBreakdown.innerHTML = '';
    } else {
      const seg = function (type, n, label) {
        if (n === 0) return '';
        return '<span class="stats-breakdown-seg stats-breakdown-seg--' + type + '">' + n + ' ' + escapeHtml(label) + '</span>';
      };
      const partList = [
        seg('avoidable', avoidableCount, labels.avoidable),
        seg('fertile', fertileCount, labels.fertile),
        seg('observed', observedCount, labels.observed)
      ].filter(Boolean);
      statsBreakdown.innerHTML = partList.join('<span class="stats-breakdown-sep"> · </span>');
    }
  }

  if (statsInsightChart) {
    renderStatsInsightChart(avoidableCount, fertileCount, observedCount);
  }

  if (statsNote) {
    if (count === 0) {
      statsNote.textContent = MODE === 'inside'
        ? "No moments yet. Add one when you're ready."
        : "Nothing logged yet. Add one when something comes up.";
    } else {
      const parts = [];
      if (avoidableCount > 0) {
        parts.push(avoidableCount === 1
          ? '1 ' + labels.avoidable + ' to learn from'
          : avoidableCount + ' ' + labels.avoidable + ' ' + reduceHint);
      }
      if (fertileCount > 0) {
        parts.push(fertileCount === 1
          ? '1 ' + labels.fertile + ' — nice'
          : fertileCount + ' ' + labels.fertile + ' ' + fertileHint);
      }
      if (avoidableCount === 0 && fertileCount === 0 && observedCount > 0) {
        parts.push(observedCount === 1
          ? '1 ' + labels.observed + ' moment noticed'
          : observedCount + ' ' + labels.observed + ' moments noticed');
      }
      if (topTheme && topThemeCount > 0) {
        const themeLabels = { calm: 'calm', focus: 'focused', stressed: 'stressed', curious: 'curious', tired: 'tired' };
        const themeLabel = themeLabels[topTheme] || topTheme;
        parts.push('you were mostly ' + themeLabel);
      }
      statsNote.textContent = parts.join(' · ');
    }
  }

  if (streakNote) {
    const streak = getCurrentStreak();
    if (streak <= 0) {
      streakNote.textContent = '';
      streakNote.innerHTML = '';
    } else if (streak === 1) {
      streakNote.textContent = "Day one — you started.";
      streakNote.innerHTML = '';
    } else if (streak === 2) {
      const triggerBtn = '<button type="button" class="streak-reflection-trigger">what helped you show up?</button>';
      try {
        const stored = localStorage.getItem(STREAK_REFLECTION_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : null;
        if (parsed && parsed.streak === 2 && parsed.line) {
          streakNote.innerHTML = '2 days in a row — ' + triggerBtn + ' ' + escapeHtml(parsed.line);
        } else {
          streakNote.innerHTML = '2 days in a row — ' + triggerBtn;
        }
      } catch (_) {
        streakNote.innerHTML = '2 days in a row — ' + triggerBtn;
      }
    } else if (streak < 7) {
      streakNote.textContent = streak + " days running — momentum building.";
      streakNote.innerHTML = '';
    } else {
      streakNote.textContent = streak + "-day streak — that's a real habit.";
      streakNote.innerHTML = '';
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

function renderStatsInsightChart(avoidableCount, fertileCount, observedCount) {
  if (!statsInsightChart) return;
  const total = avoidableCount + fertileCount + observedCount;
  if (total === 0) {
    statsInsightChart.innerHTML = '';
    statsInsightChart.classList.add('hidden');
    return;
  }
  statsInsightChart.classList.remove('hidden');
  const a = avoidableCount / total;
  const f = fertileCount / total;
  const o = observedCount / total;
  const labels = MODE === 'inside' ? { avoidable: 'heat', fertile: 'shift', observed: 'support' } : { avoidable: 'avoidable', fertile: 'fertile', observed: 'observed' };
  const seg = function (type, ratio, count) {
    if (count === 0) return '';
    const pct = Math.round(ratio * 100);
    const title = count + ' ' + labels[type];
    return '<span class="stats-insight-chart-seg stats-insight-chart-seg--' + type + '" style="flex-grow:' + ratio + ';min-width:' + (pct > 0 ? '2px' : '0') + '" title="' + escapeHtml(title) + '" role="presentation"></span>';
  };
  statsInsightChart.innerHTML =
    '<div class="stats-insight-chart-bar" role="img" aria-label="' + escapeHtml(total + ' in this period: ' + avoidableCount + ' ' + labels.avoidable + ', ' + fertileCount + ' ' + labels.fertile + ', ' + observedCount + ' ' + labels.observed) + '">' +
      seg('avoidable', a, avoidableCount) +
      seg('fertile', f, fertileCount) +
      seg('observed', o, observedCount) +
    '</div>';
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
    note.textContent = entry.note || "I couldn't tell";
    if (entry.note) {
      note.title = entry.note;
      note.dataset.fullNote = entry.note;
    }
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

  if (emptyState) {
    emptyState.classList.toggle('hidden', show.length > 0);
    if (emptyState.classList.contains('empty-state-add')) emptyState.disabled = isAtLimit();
  }
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
  const pad = { top: 18, right: 12, bottom: 32, left: 38 };
  const w = 400;
  const h = 180;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...days.map(d => Math.max(d.avoidable, d.fertile, d.observed, 1)));
  const scaleY = (v) => pad.top + chartH - (v / maxVal) * chartH;
  const scaleX = (i) => pad.left + (i / (days.length - 1 || 1)) * chartW;

  const avoidableColor = '#c99a7a';
  const fertileColor = '#6ba88a';
  const observedColor = '#8b9bb8';
  const gridColor = 'rgba(255,255,255,0.06)';
  const labelColor = 'rgba(255,255,255,0.4)';
  const strokeW = 2.5;
  const dotR = 3.5;

  const series = [
    { key: 'avoidable', color: avoidableColor },
    { key: 'fertile', color: fertileColor },
    { key: 'observed', color: observedColor }
  ];

  let svg = '';

  // Horizontal grid lines (4 lines)
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH * i) / 4;
    const val = Math.round(maxVal * (1 - i / 4));
    svg += '<line x1="' + pad.left + '" y1="' + y + '" x2="' + (pad.left + chartW) + '" y2="' + y + '" stroke="' + gridColor + '" stroke-width="0.5" stroke-dasharray="4 4"/>';
    if (val > 0) {
      svg += '<text x="' + (pad.left - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="9" fill="' + labelColor + '" font-family="DM Sans, sans-serif">' + val + '</text>';
    }
  }

  // Vertical grid (every 2 days) + day labels
  const labelIndices = [0, 6, 12, 13];
  labelIndices.forEach((i) => {
    if (i >= days.length) return;
    const x = scaleX(i);
    if (i > 0 && i < days.length - 1) {
      svg += '<line x1="' + x + '" y1="' + pad.top + '" x2="' + x + '" y2="' + (pad.top + chartH) + '" stroke="' + gridColor + '" stroke-width="0.5" stroke-dasharray="4 4"/>';
    }
    const d = new Date(days[i].dayStart);
    const label = i === 0 ? '14d ago' : i === days.length - 1 ? 'Today' : (14 - i) + 'd';
    svg += '<text x="' + x + '" y="' + (h - 8) + '" text-anchor="middle" font-size="9" fill="' + labelColor + '" font-family="DM Sans, sans-serif">' + label + '</text>';
  });

  // Chart area background
  svg += '<rect x="' + pad.left + '" y="' + pad.top + '" width="' + chartW + '" height="' + chartH + '" fill="rgba(255,255,255,0.02)" rx="4"/>';

  // Lines + dots; value shown only on hover
  series.forEach((s) => {
    const pts = days.map((d, i) => scaleX(i) + ',' + scaleY(d[s.key]));
    svg += '<polyline fill="none" stroke="' + s.color + '" stroke-width="' + strokeW + '" stroke-linecap="round" stroke-linejoin="round" points="' + pts.join(' ') + '"></polyline>';
    days.forEach((d, i) => {
      const v = d[s.key];
      if (v === 0) return;
      const cx = scaleX(i);
      const cy = scaleY(v);
      svg += '<g class="chart-point" style="cursor:pointer"><circle cx="' + cx + '" cy="' + cy + '" r="' + dotR + '" fill="' + s.color + '" stroke="var(--bg)" stroke-width="1.5"/><text class="chart-point-value" x="' + cx + '" y="' + (cy - 10) + '" text-anchor="middle" font-size="9" font-weight="600" fill="' + s.color + '" font-family="DM Sans, sans-serif">' + v + '</text></g>';
    });
  });

  lineChartSvg.innerHTML = svg;

  // Tap/click to show value (touch has no hover)
  lineChartSvg.querySelectorAll('.chart-point').forEach((g) => {
    const txt = g.querySelector('.chart-point-value');
    if (!txt) return;
    const show = () => {
      lineChartSvg.querySelectorAll('.chart-point-value').forEach((t) => {
        if (t !== txt) t.classList.remove('visible');
      });
      txt.classList.add('visible');
    };
    const hide = () => txt.classList.remove('visible');
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (txt.classList.contains('visible')) hide();
      else show();
    });
    g.addEventListener('mouseenter', show);
    g.addEventListener('mouseleave', hide);
  });
  lineChartSvg.addEventListener('click', (e) => {
    if (!e.target.closest('.chart-point')) {
      lineChartSvg.querySelectorAll('.chart-point-value').forEach((t) => t.classList.remove('visible'));
    }
  });

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

  if (weeklyDigestChart || weeklyDigest) {
    const { thisWeek } = getThisWeekAndLastWeek();
    const total = thisWeek.avoidable + thisWeek.fertile + thisWeek.observed;
    if (total === 0) {
      if (weeklyDigestChart) {
        weeklyDigestChart.innerHTML = '';
        weeklyDigestChart.classList.add('hidden');
      }
      if (weeklyDigest) weeklyDigest.textContent = 'Log a few entries to see your week chart here.';
    } else {
      const explLabel = MODE === 'inside' ? 'shift' : 'exploration';
      const expl = thisWeek.exploration != null ? thisWeek.exploration : 0;
      if (weeklyDigestChart) {
        weeklyDigestChart.classList.remove('hidden');
        const a = total > 0 ? thisWeek.avoidable / total : 0;
        const f = total > 0 ? thisWeek.fertile / total : 0;
        const o = total > 0 ? thisWeek.observed / total : 0;
        const seg = (type, ratio, count) => {
          if (count === 0) return '';
          const pct = Math.round(ratio * 100);
          return '<span class="insight-weekly-seg insight-weekly-seg--' + type + '" style="flex:' + ratio + ' 1 0%;min-width:' + (pct > 0 ? '4px' : '0') + '" title="' + count + ' ' + (type === 'avoidable' ? aLabel : type === 'fertile' ? fLabel : oLabel) + '"></span>';
        };
        weeklyDigestChart.innerHTML =
          '<div class="insight-weekly-bar" role="img" aria-label="This week: ' + thisWeek.avoidable + ' ' + aLabel + ', ' + thisWeek.fertile + ' ' + fLabel + ', ' + thisWeek.observed + ' ' + oLabel + '">' +
            seg('avoidable', a, thisWeek.avoidable) +
            seg('fertile', f, thisWeek.fertile) +
            seg('observed', o, thisWeek.observed) +
          '</div>' +
          '<div class="insight-weekly-meta">' +
            '<span class="insight-weekly-total">' + total + ' total</span>' +
            (thisWeek.avoidable || thisWeek.fertile ? '<span class="insight-weekly-expl" title="' + explLabel + '">' + expl + '% ' + explLabel + '</span>' : '') +
          '</div>';
      }
      if (weeklyDigest) {
        if (thisWeek.exploration != null && (thisWeek.avoidable || thisWeek.fertile)) {
          weeklyDigest.textContent = thisWeek.exploration >= 40 ? 'Good mix of fertile risks.' : 'Room to add more experiments.';
        } else {
          weeklyDigest.textContent = 'Keep logging to see your exploration trend.';
        }
      }
    }
  }

  if (dayVsAverageChart || dayVsAverage) {
    const todayStart = getStartOfDay(Date.now());
    const todayEnd = todayStart + 86400000;
    const todayEntries = entries.filter(e => e.at >= todayStart && e.at < todayEnd);
    const todayCount = todayEntries.length;
    const last7 = getDayCountsLastN(7);
    const total7 = last7.reduce((s, d) => s + d.total, 0);
    const avgPerDay = total7 > 0 ? parseFloat((total7 / 7).toFixed(1)) : 0;
    const maxVal = Math.max(todayCount, avgPerDay, 1);
    if (todayCount === 0 && total7 === 0) {
      if (dayVsAverageChart) dayVsAverageChart.innerHTML = '';
      if (dayVsAverage) dayVsAverage.textContent = 'Start logging to see how today compares.';
    } else {
      if (dayVsAverageChart) {
        const todayW = (todayCount / maxVal) * 100;
        const avgW = (avgPerDay / maxVal) * 100;
        dayVsAverageChart.innerHTML =
          '<div class="insight-compare"><div class="insight-compare-row"><span class="insight-compare-label">Today</span><div class="insight-compare-bar-wrap"><div class="insight-compare-bar insight-compare-bar--today" style="width:' + todayW + '%"></div></div><span class="insight-compare-val">' + todayCount + '</span></div>' +
          '<div class="insight-compare-row"><span class="insight-compare-label">Avg</span><div class="insight-compare-bar-wrap"><div class="insight-compare-bar insight-compare-bar--avg" style="width:' + avgW + '%"></div></div><span class="insight-compare-val">' + (avgPerDay > 0 ? avgPerDay : '—') + '</span></div></div>';
      }
      if (dayVsAverage) {
        if (total7 === 0) dayVsAverage.textContent = todayCount + ' today — your first day. Keep going.';
        else {
          const diff = todayCount - avgPerDay;
          if (Math.abs(diff) < 0.5) dayVsAverage.textContent = 'About your usual pace.';
          else if (diff > 0) dayVsAverage.textContent = 'Above average — notice any triggers?';
          else dayVsAverage.textContent = 'Below average — lighter day.';
        }
      }
    }
  }

  if (timeOfDayChart || timeOfDay) {
    if (entries.length === 0) {
      if (timeOfDayChart) timeOfDayChart.innerHTML = '';
      if (timeOfDay) timeOfDay.textContent = 'Log at different times to see your patterns.';
    } else {
      const hours = entries.map(e => new Date(e.at).getHours());
      const morning = hours.filter(h => h >= 5 && h < 12).length;
      const afternoon = hours.filter(h => h >= 12 && h < 17).length;
      const evening = hours.filter(h => h >= 17 || h < 2).length;
      const total = morning + afternoon + evening;
      const max = Math.max(morning, afternoon, evening);
      if (timeOfDayChart && total > 0) {
        const mR = morning / total; const aR = afternoon / total; const eR = evening / total;
        const seg = (count, ratio, label) => '<span class="insight-time-seg insight-time-seg--' + label + '" style="flex:' + ratio + ' 1 0%" title="' + count + ' ' + label + '"></span>';
        timeOfDayChart.innerHTML = '<div class="insight-time-bar">' + seg(morning, mR, 'morning') + seg(afternoon, aR, 'afternoon') + seg(evening, eR, 'evening') + '</div><div class="insight-time-legend"><span>AM</span><span>PM</span><span>Eve</span></div>';
      }
      if (timeOfDay) {
        if (max === 0) timeOfDay.textContent = 'No clear peak yet.';
        else if (morning === max) timeOfDay.textContent = 'Morning peak — good for reflection.';
        else if (afternoon === max) timeOfDay.textContent = 'Afternoon peak.';
        else timeOfDay.textContent = 'Evening peak — end-of-day review.';
      }
    }
  }

  if (topPatternsChart) {
    const STOP_WORDS = new Set(['a', 'an', 'the', 'is', 'it', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'i', 'me', 'my', 'we', 'be', 'so', 'no', 'or', 'and', 'but', 'if', 'as', 'up', 'do', 'go', 'get', 'got']);
    const bigramCounts = {};
    const bigramInNotes = {};
    entries.forEach(e => {
      const note = (e.note || '').trim().toLowerCase();
      if (note.length < 3) return;
      const words = note.replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
      const seen = new Set();
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = words[i] + ' ' + words[i + 1];
        if (seen.has(bigram)) continue;
        seen.add(bigram);
        bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
        if (!bigramInNotes[bigram]) bigramInNotes[bigram] = [];
        if (bigramInNotes[bigram].indexOf(note) === -1) bigramInNotes[bigram].push(note);
      }
    });
    const sorted = Object.entries(bigramCounts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (sorted.length === 0) {
      topPatternsChart.innerHTML = '<p class="insight-chart-empty">Two-word phrases you use in 2+ notes will appear here. E.g. "speak loud" in multiple entries.</p>';
    } else {
      const maxC = sorted[0][1];
      const rows = sorted.map(([phrase, count]) => {
        const w = (count / maxC) * 100;
        const short = phrase.length > 22 ? phrase.slice(0, 19) + '…' : phrase;
        const notes = (bigramInNotes[phrase] || []).slice(0, 3).join(' · ');
        const title = notes ? '"' + phrase + '" in: ' + notes : phrase + ' (2+ notes)';
        return '<div class="insight-pattern-row"><span class="insight-pattern-label" title="' + escapeHtml(title) + '">' + escapeHtml(short) + '</span><div class="insight-pattern-bar-wrap"><div class="insight-pattern-bar" style="width:' + w + '%"></div></div><span class="insight-pattern-count">' + count + '×</span></div>';
      }).join('');
      topPatternsChart.innerHTML = '<div class="insight-patterns-chart">' + rows + '</div>';
    }
  }

  if (morePatternsChart) {
    const themes = { calm: 0, focus: 0, stressed: 0, curious: 0, tired: 0 };
    entries.forEach(e => {
      const t = (e.theme === 'focus' || e.theme === 'stressed' || e.theme === 'curious' || e.theme === 'tired') ? e.theme : 'calm';
      themes[t] = (themes[t] || 0) + 1;
    });
    const sorted = Object.entries(themes).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      morePatternsChart.innerHTML = '<p class="insight-chart-empty">Log with different moods to see patterns.</p>';
    } else {
      const maxC = sorted[0][1];
      const rows = sorted.map(([theme, count]) => {
        const w = (count / maxC) * 100;
        return '<div class="insight-mood-row"><span class="insight-mood-label insight-mood-label--' + theme + '">' + theme + '</span><div class="insight-mood-bar-wrap"><div class="insight-mood-bar-seg insight-mood-bar-seg--' + theme + '" style="width:' + w + '%"></div></div><span class="insight-mood-count">' + count + '</span></div>';
      }).join('');
      morePatternsChart.innerHTML = '<div class="insight-mood-chart">' + rows + '</div>';
    }
  }

  if (biasCheckInsight && biasCheckInsightBlock) {
    const filtered = filterByPeriod(currentPeriod);
    const observed = filtered.filter(e => (e.type || 'avoidable') === 'observed');
    const oLabel = MODE === 'inside' ? 'support' : 'observed';

    if (biasCheckCountBtn) {
      biasCheckCountBtn.textContent = observed.length;
      biasCheckCountBtn.setAttribute('data-label', 'You');
      biasCheckCountBtn.setAttribute('aria-label', (MODE === 'inside' ? 'Support' : 'Observed') + ' in this period (yours): ' + observed.length);
      biasCheckCountBtn.title = (MODE === 'inside' ? 'Support' : 'Observed') + ' in this period (yours): ' + observed.length;
    }
    if (biasCheckCountGlobalBtn) {
      const g = lastGlobalObservedCount;
      biasCheckCountGlobalBtn.textContent = typeof g === 'number' ? g : '—';
      biasCheckCountGlobalBtn.setAttribute('data-label', 'All');
      biasCheckCountGlobalBtn.setAttribute('aria-label', 'Observed from everyone\'s shared entries: ' + (typeof g === 'number' ? g : '—'));
      biasCheckCountGlobalBtn.title = 'Observed from everyone\'s shared entries: ' + (typeof g === 'number' ? g : '—');
    }

    if (observed.length > 0) {
      const observedSorted = observed.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
      const pills = observedSorted.slice(0, 3).map(function (e) {
        const note = (e.note || '').trim() || "I couldn't tell";
        const short = note.length > 20 ? note.slice(0, 17) + '…' : note;
        const biasLabel = (e.biasReason && BIAS_LABELS[e.biasReason]) ? ' <span class="bias-check-choice">' + BIAS_LABELS[e.biasReason] + '</span>' : '';
        return '<span class="bias-check-note-pill" title="' + escapeHtml(note) + '">' + escapeHtml(short) + biasLabel + '</span>';
      }).join(' ');
      biasCheckInsight.innerHTML =
        '<div class="bias-check-insight-row">' +
          '<div class="bias-check-data">' + observed.length + ' ' + oLabel + (pills ? ' · ' + pills : '') + '</div>' +
          '<div class="bias-check-share-line">Share to add to everyone\'s feed. Use <strong>Bias Check</strong> when adding.</div>' +
        '</div>';
    } else {
      biasCheckInsight.innerHTML =
        '<div class="bias-check-insight-row">' +
          '<div class="bias-check-data">No ' + oLabel + ' yet.</div>' +
          '<div class="bias-check-share-line">Observed entries can be shared. Use Bias Check when adding.</div>' +
        '</div>';
    }
    biasCheckInsightBlock.classList.remove('hidden');
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
  const statsBreakdownEl = document.getElementById('stats-breakdown');
  const streakNoteEl = document.getElementById('streak-note');
  const statExplorationSoWhatEl = document.getElementById('stat-exploration-so-what');
  if (!statCountEl || !statLabelEl) return;

  const scale = Math.min(window.devicePixelRatio || 2, 3);
  const w = 520 * scale;
  const h = 340 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const pad = 28 * scale;
  const s = (v) => v * scale;

  // SlipUp colors
  const bg = '#0b1013';
  const surface = '#151b20';
  const accent = '#7260ff';
  const text = '#eef3f7';
  const muted = '#8f9ba7';
  const border = '#28333d';

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Card surface (rounded rect)
  const cardX = pad;
  const cardY = pad;
  const cardW = w - pad * 2;
  const cardH = h - pad * 2;
  const radius = s(12);
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  } else {
    ctx.rect(cardX, cardY, cardW, cardH);
  }
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Accent bar top
  ctx.fillStyle = accent;
  ctx.fillRect(cardX, cardY, cardW, s(4));

  // Title
  ctx.fillStyle = text;
  ctx.font = 'bold ' + s(24) + 'px "DM Sans", system-ui, sans-serif';
  ctx.fillText('SlipUp', cardX + pad, cardY + s(42));

  // Main stat — prominent
  const countStr = statCountEl.textContent + ' ' + (statLabelEl.textContent || '');
  ctx.font = '600 ' + s(20) + 'px "DM Sans", system-ui, sans-serif';
  ctx.fillStyle = text;
  ctx.fillText(countStr, cardX + pad, cardY + s(78));

  let y = cardY + s(110);
  ctx.font = s(14) + 'px "DM Sans", system-ui, sans-serif';

  // Avg
  if (statAvgEl && statAvgEl.textContent !== '—') {
    ctx.fillStyle = muted;
    ctx.fillText('Avg ' + statAvgEl.textContent + '/day', cardX + pad, y);
    y += s(28);
  }

  // Exploration
  if (statExplorationEl && statExplorationEl.textContent !== '—') {
    const explLabel = MODE === 'inside' ? 'Shift index' : 'Exploration';
    ctx.fillStyle = muted;
    ctx.fillText(explLabel + ' ' + statExplorationEl.textContent, cardX + pad, y);
    y += s(28);
  }

  // Breakdown
  if (statsBreakdownEl && statsBreakdownEl.textContent) {
    ctx.fillStyle = muted;
    ctx.fillText(statsBreakdownEl.textContent, cardX + pad, y);
    y += s(28);
  }

  // Streak or insight
  const insight = (streakNoteEl && streakNoteEl.textContent) || (statExplorationSoWhatEl && statExplorationSoWhatEl.textContent);
  if (insight) {
    ctx.fillStyle = accent;
    ctx.font = '500 ' + s(13) + 'px "DM Sans", system-ui, sans-serif';
    ctx.fillText(insight, cardX + pad, y);
  }

  // Footer
  ctx.fillStyle = muted;
  ctx.font = s(11) + 'px "DM Sans", system-ui, sans-serif';
  ctx.fillText('slipup.io', cardX + pad, cardH + cardY - s(20));

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
  if (type === 'observed' && lastBiasCheckReason) {
    entry.biasReason = lastBiasCheckReason;
    lastBiasCheckReason = null;
  }
  entries.push(entry);
  lastEntry = entry;
  saveEntries();
  addNoteInput.value = '';
  updateAddButtonState();
  updateUpgradeUI();
  if (addNoteInput) addNoteInput.focus();
  renderStats();
  renderList();
  if (SHARING_ENABLED) pushEntryToShared({ note, type, theme: entry.theme });
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
  periodTabs.forEach(t => {
    const isActive = t.dataset.period === period;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
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
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: (url, opts) => {
        // Do not add cache-bust query params: PostgREST treats unknown params as column filters,
        // which caused "failed to parse filter (1771012233100)" when _=Date.now() was appended.
        return fetch(url, { ...opts, cache: 'no-store' });
      }
    }
  });
}

function getCurrentStatsForShare() {
  const filtered = filterByPeriod(currentPeriod);
  const count = filtered.length;
  const days = getDaysInPeriod(currentPeriod);
  const avg = days > 0 ? parseFloat((count / days).toFixed(1)) : null;
  return { period: currentPeriod, count, avg_per_day: avg };
}

function saveStreakReflectionToSupabase(choice) {
  if (!SHARING_ENABLED || !choice) return;
  try {
    const client = getSupabase();
    client.from(STREAK_REFLECTIONS_TABLE).insert({
      anonymous_id: getOrCreateAnonId(),
      mode: MODE,
      choice: choice,
      streak: 2
    }).then(({ error }) => {
      if (error) console.warn('SlipUp: streak reflection save failed', { table: STREAK_REFLECTIONS_TABLE, error });
    });
  } catch (e) {
    console.warn('SlipUp: streak reflection save failed', e);
  }
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
  if (type === 'observed' && lastBiasCheckReason) {
    entry.biasReason = lastBiasCheckReason;
    lastBiasCheckReason = null;
  }
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
    if (communityMetricsChart) communityMetricsChart.innerHTML = '';
    if (sharedListChart) sharedListChart.innerHTML = '';
    sharedEmpty.classList.remove('hidden');
    return;
  }
  sharedEmpty.classList.toggle('hidden', (data && data.length) > 0);
  if (!data || data.length === 0) {
    if (sharedListChart) sharedListChart.innerHTML = '';
    sharedEmpty.textContent = MODE === 'inside'
      ? "No shared results yet. Share your period above!"
      : "No shared results yet. Share yours above!";
    if (communityMetricsChart) communityMetricsChart.innerHTML = '';
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
  const allRows = groupKeys.flatMap(anonKey => (byAnon[anonKey] || []));
  const maxCount = allRows.length > 0 ? Math.max(...allRows.map(r => r.count)) : 1;
  let chartHtml = '';
  groupKeys.forEach(anonKey => {
    const rows = byAnon[anonKey] || [];
    const shareCount = rows.length;
    chartHtml += '<div class="shared-group-chart"><div class="shared-group-label">' + (shareCount === 1 ? "Someone's share" : "Someone's shares (" + shareCount + ")") + '</div><div class="shared-chart-rows">';
    rows.forEach(row => {
      const periodLabel = getPeriodLabel(row.period);
      const timeStr = row.created_at ? new Date(row.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
      const avgStr = row.avg_per_day != null ? String(row.avg_per_day) : '—';
      const w = (row.count / maxCount) * 100;
      chartHtml += '<div class="shared-chart-row"><span class="shared-chart-label">' + periodLabel + '</span><div class="shared-chart-bar-wrap"><div class="shared-chart-bar" style="width:' + w + '%"></div></div><span class="shared-chart-meta">' + row.count + ' · ' + avgStr + '/day · ' + timeStr + '</span></div>';
    });
    chartHtml += '</div></div>';
  });
  if (sharedListChart) sharedListChart.innerHTML = chartHtml;
  if (communityMetricsChart) {
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
      communityMetricsChart.innerHTML = '';
    } else {
      communityMetricsChart.innerHTML =
        '<div class="community-metrics-bars">' +
        '<div class="community-metric-row"><span class="community-metric-label">Shares</span><div class="community-metric-bar-wrap"><div class="community-metric-bar community-metric-bar--shares" style="width:' + Math.min(100, (shareCount / 20) * 100) + '%"></div></div><span class="community-metric-val">' + shareCount + '</span></div>' +
        '<div class="community-metric-row"><span class="community-metric-label">People</span><div class="community-metric-bar-wrap"><div class="community-metric-bar community-metric-bar--people" style="width:' + Math.min(100, (peopleCount / 10) * 100) + '%"></div></div><span class="community-metric-val">' + peopleCount + '</span></div>' +
        '</div>' +
        '<p class="community-metrics-note">Last 7 days (approximate)</p>';
    }
  }
}

function showCommunitySetupMessage() {
  if (!sharedListChart || !sharedEmpty) return;
  sharedListChart.innerHTML = '';
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

    // 1) Fetch entries for the list (last 10 or 50)
    const { data, error } = await client
      .from(ENTRIES_TABLE)
      .select('id, note, type, theme, created_at')
      .eq('mode', MODE)
      .order('created_at', { ascending: false })
      .limit(sharedEntriesLimit);
    if (error) throw error;

    // 2) Fetch global totals: overall count + counts by type (for "X shared" and chart)
    let globalTotal = 0;
    let globalAvoidable = 0;
    let globalFertile = 0;
    let globalObserved = 0;
    try {
      const [totalRes, avoidRes, fertRes, obsRes] = await Promise.all([
        client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('mode', MODE),
        client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('mode', MODE).eq('type', 'avoidable'),
        client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('mode', MODE).eq('type', 'fertile'),
        client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('mode', MODE).eq('type', 'observed')
      ]);
      const getCount = (r) => (r && typeof r.count === 'number' ? r.count : 0);
      globalTotal = getCount(totalRes);
      globalAvoidable = getCount(avoidRes);
      globalFertile = getCount(fertRes);
      globalObserved = getCount(obsRes);
    } catch (_) {
      /* ignore */
    }
    sharedEntriesList.innerHTML = '';
    const list = data || [];
    lastSharedEntries = list;

    // List-based counts for trend text only ("Last X shared entries: a avoidable · f fertile · o observed")
    let avoidable = 0;
    let fertile = 0;
    let observed = 0;
    list.forEach(row => {
      const t = row.type || 'avoidable';
      if (t === 'fertile') fertile += 1;
      else if (t === 'observed') observed += 1;
      else avoidable += 1;
    });

    if (communityEntriesRange) {
      const label = sharedEntriesLimit === 10 ? 'last 10' : 'last 50';
      const noun = MODE === 'inside' ? 'shared moments' : 'shared entries';
      communityEntriesRange.textContent = 'Showing ' + label + ' ' + noun + ' (most recent first).';
    }
    sharedEntriesEmpty.classList.toggle('hidden', list.length > 0);
    sharedEntriesEmpty.textContent = list.length === 0
      ? (MODE === 'inside' ? "No shared moments yet. Add one to share yours." : "No shared entries yet. Add a mistake to share yours.")
      : "";
    if (sharedEntriesError) {
      sharedEntriesError.classList.add('hidden');
      sharedEntriesError.textContent = '';
    }
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

    lastGlobalObservedCount = globalObserved;
    if (biasCheckCountGlobalBtn) {
      biasCheckCountGlobalBtn.textContent = globalObserved;
      biasCheckCountGlobalBtn.setAttribute('data-label', 'All');
      biasCheckCountGlobalBtn.setAttribute('aria-label', 'Observed from everyone\'s shared entries: ' + globalObserved);
      biasCheckCountGlobalBtn.title = 'Observed from everyone\'s shared entries: ' + globalObserved;
    }
    renderInsights();
    // Chart shows global totals (all shared entries by type); trend shows current list slice
    renderGlobalCountChart(globalAvoidable, globalFertile, globalObserved);
    const total = globalTotal > 0 ? globalTotal : (avoidable + fertile + observed);
    if (btnSharedTotal) {
      btnSharedTotal.textContent = '🌍 ' + total + ' slip-ups';
      btnSharedTotal.setAttribute('aria-label', 'World slip-ups: ' + total);
    }
    if (topBarSlipups) {
      topBarSlipups.textContent = '🌍 ' + total + ' slip-ups';
      topBarSlipups.setAttribute('aria-label', 'World slip-ups: ' + total);
    }
    renderSharedEntriesList();
  } catch (err) {
    const raw = err && (err.message || err.error_description || err.msg) || '';
    const msg = typeof raw === 'string' ? raw : (raw && raw.message) || 'Unknown error';
    if (communityComparison) communityComparison.textContent = '';
    if (communityEntriesTrend) communityEntriesTrend.textContent = '';
    renderGlobalCountChart(0, 0, 0);
    if (btnSharedTotal) btnSharedTotal.textContent = '🌍 0 slip-ups';
    if (topBarSlipups) topBarSlipups.textContent = '🌍 0 slip-ups';
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

function renderGlobalCountChart(avoidable, fertile, observed) {
  if (!globalCountChart) return;
  const total = avoidable + fertile + observed;
  if (total === 0) {
    globalCountChart.innerHTML = '';
    globalCountChart.classList.add('hidden');
    globalCountChart.setAttribute('aria-hidden', 'true');
    return;
  }
  globalCountChart.classList.remove('hidden');
  globalCountChart.setAttribute('aria-hidden', 'false');
  globalCountChart.setAttribute('aria-label', (MODE === 'inside' ? 'Global count of shared moments' : 'Global count of shared entries') + ' by type (all time)');
  const aLab = MODE === 'inside' ? 'Heat' : 'Avoidable';
  const fLab = MODE === 'inside' ? 'Shift' : 'Fertile';
  const oLab = MODE === 'inside' ? 'Support' : 'Observed';
  const aFlex = Math.max(avoidable, 1);
  const fFlex = Math.max(fertile, 1);
  const oFlex = Math.max(observed, 1);
  const caption = MODE === 'inside' ? 'All shared moments (global)' : 'All shared entries (global)';
  globalCountChart.innerHTML =
    '<p class="global-count-chart-caption">' + caption + '</p>' +
    '<div class="global-count-chart-bar" role="img">' +
      '<span class="global-count-segment global-count-avoidable" style="flex:' + aFlex + '" title="' + aLab + ': ' + avoidable + '"></span>' +
      '<span class="global-count-segment global-count-fertile" style="flex:' + fFlex + '" title="' + fLab + ': ' + fertile + '"></span>' +
      '<span class="global-count-segment global-count-observed" style="flex:' + oFlex + '" title="' + oLab + ': ' + observed + '"></span>' +
    '</div>' +
    '<div class="global-count-chart-labels">' +
      '<span class="global-count-label"><span class="global-count-dot global-count-avoidable"></span>' + aLab + ' <strong>' + avoidable + '</strong></span>' +
      '<span class="global-count-label"><span class="global-count-dot global-count-fertile"></span>' + fLab + ' <strong>' + fertile + '</strong></span>' +
      '<span class="global-count-label"><span class="global-count-dot global-count-observed"></span>' + oLab + ' <strong>' + observed + '</strong></span>' +
    '</div>';
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
    note.textContent = row.note || "I couldn't tell";
    if (row.note) {
      note.title = row.note;
      note.dataset.fullNote = row.note;
    }
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

function applySharedEntriesTypeFilter(value) {
  sharedEntriesTypeFilter = value || 'all';
  if (sharedEntriesFilters) {
    const typeButtons = sharedEntriesFilters.querySelectorAll('button[data-filter-type]');
    typeButtons.forEach(btn => {
      btn.classList.toggle('active', (btn.getAttribute('data-filter-type') || 'all') === sharedEntriesTypeFilter);
      btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
    });
  }
  if (globalCountChart) {
    globalCountChart.querySelectorAll('.global-count-label-btn').forEach(btn => {
      const type = btn.getAttribute('data-filter-type');
      const active = type === sharedEntriesTypeFilter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  renderSharedEntriesList();
}

function handleSharedEntriesFilterClick(e) {
  const target = e.target.closest('button[data-filter-type], button[data-filter-theme]');
  if (!target) return;
  if (sharedEntriesFilters && sharedEntriesFilters.contains(target)) {
    if (target.hasAttribute('data-filter-type')) {
      applySharedEntriesTypeFilter(target.getAttribute('data-filter-type') || 'all');
      return;
    }
    if (target.hasAttribute('data-filter-theme')) {
      const value = target.getAttribute('data-filter-theme') || 'all';
      sharedEntriesThemeFilter = value;
      const themeButtons = sharedEntriesFilters.querySelectorAll('button[data-filter-theme]');
      themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn === target);
      });
      renderSharedEntriesList();
      return;
    }
  }
  if (target.classList.contains('global-count-label-btn') && target.hasAttribute('data-filter-type')) {
    applySharedEntriesTypeFilter(target.getAttribute('data-filter-type'));
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
    if (btnSharedEntriesToggle) btnSharedEntriesToggle.addEventListener('click', toggleSharedEntriesView);
    if (sharedEntriesFilters) sharedEntriesFilters.addEventListener('click', handleSharedEntriesFilterClick);
    if (globalCountChart) {
      globalCountChart.addEventListener('click', function (e) {
        const btn = e.target.closest('.global-count-label-btn');
        if (!btn || !btn.hasAttribute('data-filter-type')) return;
        const type = btn.getAttribute('data-filter-type');
        applySharedEntriesTypeFilter(type === sharedEntriesTypeFilter ? 'all' : type);
      });
    }
    if (btnAddFromCommunity) {
      btnAddFromCommunity.addEventListener('click', function () {
        const main = document.getElementById('main');
        if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (addNoteInput) setTimeout(function () { addNoteInput.focus(); }, 300);
      });
    }
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
const MISTAKE_NOTE_MAXLEN = 19;
if (addNoteInput) {
  addNoteInput.setAttribute('maxlength', String(MISTAKE_NOTE_MAXLEN));
  addNoteInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addMistake();
  });
  addNoteInput.addEventListener('input', () => {
    if (addNoteInput.value.length > MISTAKE_NOTE_MAXLEN) addNoteInput.value = addNoteInput.value.slice(0, MISTAKE_NOTE_MAXLEN);
    updateAddButtonState();
  });
  addNoteInput.addEventListener('keyup', updateAddButtonState);
  addNoteInput.addEventListener('paste', () => {
    setTimeout(() => {
      if (addNoteInput.value.length > MISTAKE_NOTE_MAXLEN) addNoteInput.value = addNoteInput.value.slice(0, MISTAKE_NOTE_MAXLEN);
      updateAddButtonState();
    }, 0);
  });
}
updateAddButtonState();

const btnCantTell = document.getElementById('btn-cant-tell');
if (btnCantTell) btnCantTell.addEventListener('click', () => quickAdd(getSelectedType()));
if (emptyState && emptyState.classList.contains('empty-state-add')) {
  emptyState.addEventListener('click', function () {
    if (emptyState.disabled) return;
    const main = document.getElementById('main');
    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (addNoteInput) setTimeout(function () { addNoteInput.focus(); }, 300);
  });
  emptyState.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (emptyState.disabled) return;
      const main = document.getElementById('main');
      if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (addNoteInput) setTimeout(function () { addNoteInput.focus(); }, 300);
    }
  });
}

function updateTypeHint() {
  const type = getSelectedType();
  const phrase = TYPE_PHRASES[type] || TYPE_PHRASES.avoidable;
  const placeholder = TYPE_PLACEHOLDERS[type] || TYPE_PLACEHOLDERS.avoidable;
  if (typeHint) typeHint.textContent = phrase;
  if (addNoteInput) addNoteInput.placeholder = placeholder;
  if (biasCheckRow) biasCheckRow.classList.toggle('hidden', type !== 'observed');
}

function openBiasCheck() {
  if (!biasCheckOverlay || !biasCheckOptions || !biasCheckReflection) return;
  biasCheckOverlay.classList.remove('hidden');
  biasCheckOverlay.setAttribute('aria-hidden', 'false');
  biasCheckOptions.querySelectorAll('input[name="bias-reason"]').forEach(r => { r.checked = false; });
  biasCheckReflection.textContent = '';
  biasCheckReflection.classList.add('hidden');

  if (biasCheckPanelStat) {
    const note = (addNoteInput && addNoteInput.value) ? addNoteInput.value.trim() : '';
    const theme = getCurrentTheme();
    const typeLabel = MODE === 'inside' ? 'Support' : 'Observed';
    biasCheckPanelStat.textContent = note
      ? typeLabel + ': «' + note + '» · ' + theme.charAt(0).toUpperCase() + theme.slice(1)
      : typeLabel + ' entry · ' + theme.charAt(0).toUpperCase() + theme.slice(1);
    biasCheckPanelStat.classList.toggle('bias-check-panel-stat--empty', !note);
  }
  if (btnBiasCheckClose) btnBiasCheckClose.focus();
}

function closeBiasCheck() {
  if (!biasCheckOverlay) return;
  const checked = biasCheckOptions && biasCheckOptions.querySelector('input[name="bias-reason"]:checked');
  lastBiasCheckReason = (checked && checked.value) || null;
  biasCheckOverlay.classList.add('hidden');
  biasCheckOverlay.setAttribute('aria-hidden', 'true');
  if (btnBiasCheck) btnBiasCheck.focus();
}

function handleBiasOptionChange(value) {
  if (!biasCheckReflection) return;
  const msg = BIAS_REFLECTIONS[value];
  if (msg) {
    biasCheckReflection.textContent = msg;
    biasCheckReflection.classList.remove('hidden');
  }
}

if (typeInputs && typeInputs.length) {
  typeInputs.forEach(input => {
    if (input) input.addEventListener('change', updateTypeHint);
  });
}
if (typeHint) updateTypeHint();
if (biasCheckRow) updateTypeHint();

if (btnBiasCheck) btnBiasCheck.addEventListener('click', openBiasCheck);
if (btnBiasCheckClose) btnBiasCheckClose.addEventListener('click', closeBiasCheck);
if (biasCheckOverlay) {
  biasCheckOverlay.addEventListener('click', function(e) {
    if (e.target === biasCheckOverlay) closeBiasCheck();
  });
}
if (biasCheckOptions) {
  biasCheckOptions.addEventListener('change', function(e) {
    const input = e.target;
    if (input && input.name === 'bias-reason' && input.value) handleBiasOptionChange(input.value);
  });
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && biasCheckOverlay && !biasCheckOverlay.classList.contains('hidden')) closeBiasCheck();
});

/* Custom tooltip for .note (native title often doesn't work in PWA standalone) */
(function initNoteTooltip() {
  const tooltip = document.createElement('div');
  tooltip.id = 'note-tooltip';
  tooltip.className = 'note-tooltip hidden';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);
  let hideTimeout;
  function showTooltip(note) {
    if (!note || note.classList.contains('empty')) return;
    const text = note.dataset.fullNote || note.title || '';
    if (!text) return;
    clearTimeout(hideTimeout);
    tooltip.textContent = text;
    tooltip.classList.remove('hidden');
    const rect = note.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.top + 6) + 'px';
    tooltip.style.maxWidth = Math.min(300, window.innerWidth - 32) + 'px';
    tooltip.style.transform = 'translateY(-100%)';
    requestAnimationFrame(() => {
      const tr = tooltip.getBoundingClientRect();
      if (tr.top < 8) {
        tooltip.style.transform = '';
        tooltip.style.top = (rect.bottom + 6) + 'px';
      }
      if (tr.left + tr.width > window.innerWidth - 8) tooltip.style.left = Math.max(8, window.innerWidth - tr.width - 12) + 'px';
    });
  }
  function hideTooltip() {
    hideTimeout = setTimeout(() => tooltip.classList.add('hidden'), 80);
  }
  function onMouseOver(e) {
    const note = e.target && e.target.closest ? e.target.closest('.entry-item .note') : null;
    if (note && !note.classList.contains('empty')) showTooltip(note);
  }
  function onMouseOut(e) {
    const note = e.target && e.target.closest ? e.target.closest('.entry-item .note') : null;
    const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.entry-item .note') : null;
    if (note && !to) hideTooltip();
  }
  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);
  document.addEventListener('click', (e) => {
    const note = e.target && e.target.closest ? e.target.closest('.entry-item .note') : null;
    if (note && !note.classList.contains('empty')) {
      showTooltip(note);
    } else {
      hideTooltip();
    }
  });
})();

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

function ensureStreakReflectionPanel() {
  let panel = document.getElementById('streak-reflection-panel');
  if (panel) return panel;
  const parent = streakNote && streakNote.parentNode;
  if (!parent) return null;
  panel = document.createElement('div');
  panel.id = 'streak-reflection-panel';
  panel.className = 'streak-reflection-panel';
  panel.setAttribute('hidden', '');
  panel.innerHTML =
    '<p class="streak-reflection-prompt">What moved you?</p>' +
    '<div class="streak-reflection-options">' +
    Object.keys(STREAK_REFLECTION_LINES).map(function (key) {
      const label = key === 'not-sure' ? 'Not sure' : key.charAt(0).toUpperCase() + key.slice(1);
      return '<button type="button" class="streak-reflection-option" data-reflection="' + key + '">' + label + '</button>';
    }).join('') +
    '</div>';
  parent.appendChild(panel);
  panel.addEventListener('click', function (e) {
    const btn = e.target && e.target.closest('.streak-reflection-option');
    if (!btn) return;
    const key = btn.getAttribute('data-reflection');
    const line = key && STREAK_REFLECTION_LINES[key];
    if (!line || !streakNote) return;
    const triggerBtn = '<button type="button" class="streak-reflection-trigger">what helped you show up?</button>';
    streakNote.innerHTML = '2 days in a row — ' + triggerBtn + ' ' + escapeHtml(line);
    panel.setAttribute('hidden', '');
    try {
      localStorage.setItem(STREAK_REFLECTION_STORAGE_KEY, JSON.stringify({ streak: 2, line: line }));
    } catch (_) {}
    saveStreakReflectionToSupabase(key);
  });
  return panel;
}

function openStreakReflectionPanel() {
  const panel = ensureStreakReflectionPanel();
  if (panel) panel.removeAttribute('hidden');
}

if (streakNote) {
  streakNote.addEventListener('click', function (e) {
    if (e.target && e.target.closest('.streak-reflection-trigger')) {
      e.preventDefault();
      openStreakReflectionPanel();
    }
  });
}

loadEntries();
updateUpgradeUI();
renderStats();
renderList();
initSharing();
initReflection();
initMicroGoal();
initAddToHomeBanner();
initReminder();
const btnSettings = document.getElementById('btn-settings');
const settingsDropdown = document.getElementById('settings-dropdown');
if (btnSettings && settingsDropdown) {
  btnSettings.addEventListener('click', function (e) {
    e.stopPropagation();
    const open = settingsDropdown.classList.toggle('open');
    btnSettings.setAttribute('aria-expanded', open);
    settingsDropdown.setAttribute('aria-hidden', !open);
  });
  settingsDropdown.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () {
    if (settingsDropdown.classList.contains('open')) {
      settingsDropdown.classList.remove('open');
      btnSettings.setAttribute('aria-expanded', 'false');
      settingsDropdown.setAttribute('aria-hidden', 'true');
    }
  });
}
if (topBarAdd) {
  topBarAdd.addEventListener('click', function (e) {
    e.preventDefault();
    const main = document.getElementById('main');
    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (addNoteInput) setTimeout(function () { addNoteInput.focus(); }, 300);
  });
}
if (topBarSlipups && communityEntriesSection) {
  topBarSlipups.addEventListener('click', function () {
    communityEntriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
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

