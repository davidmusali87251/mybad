// Mode: "personal" (default SlipUp) or "inside" (group / in-custody)
const MODE = (typeof window !== 'undefined' && window.SLIPUP_MODE) || 'personal';

const STORAGE_KEY = MODE === 'inside' ? 'mistake-tracker-entries-inside' : 'mistake-tracker-entries';
const ANON_ID_KEY = MODE === 'inside' ? 'mistake-tracker-anon-id-inside' : 'mistake-tracker-anon-id';

// Supabase table names (separate per app)
const STATS_TABLE = MODE === 'inside' ? 'shared_stats_inside' : 'shared_stats';
const ENTRIES_TABLE = MODE === 'inside' ? 'shared_entries_inside' : 'shared_entries';
const EVENTS_TABLE = 'slipup_events';

let entries = [];
let currentPeriod = 'day';
let currentTypeFilter = 'all';
let lastEntry = null;
let lastShareAt = 0;

const CONFIG = (typeof window !== 'undefined' && window.MISTAKE_TRACKER_CONFIG) || {};
const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (CONFIG.SUPABASE_ANON_KEY || '').trim();
const SHARING_ENABLED = SUPABASE_URL && SUPABASE_ANON_KEY;
const FREE_ENTRY_LIMIT = 10;
const UNLOCKED_KEY = MODE === 'inside' ? 'mistake-tracker-unlocked-inside' : 'mistake-tracker-unlocked';
const PAYMENT_LINK_CLICKED_KEY = MODE === 'inside' ? 'mistake-tracker-payment-link-clicked-inside' : 'mistake-tracker-payment-link-clicked';
const PAYMENT_URL = (CONFIG.PAYMENT_URL || '').trim();
const PAYPAL_CLIENT_ID = (CONFIG.PAYPAL_CLIENT_ID || '').trim();
const PAYPAL_HOSTED_BUTTON_ID = (CONFIG.PAYPAL_HOSTED_BUTTON_ID || '').trim();
const PAYPAL_ENABLED = PAYPAL_CLIENT_ID && PAYPAL_HOSTED_BUTTON_ID;

const addNoteInput = document.getElementById('mistake-note');
const addBtn = document.getElementById('add-mistake');
const cantTellBtn = document.getElementById('btn-cant-tell');
const typeInputs = document.querySelectorAll('input[name="mistake-type"]');
const typeHint = document.getElementById('type-hint');
const communityComparison = document.getElementById('community-comparison');

const TYPE_PHRASES = MODE === 'inside'
  ? {
      avoidable: 'Heat — what raised the temperature? What could cool it next time?',
      fertile: 'Shift — where did you choose differently than usual?',
      observed: 'Support — where did you give, get, or see support?'
    }
  : {
      avoidable: 'Notice the trigger. How can I reduce repeats?',
      fertile: 'What did I try? What did I learn?',
      observed: 'For learning, not blaming. What did I see? What lesson applies to me?'
    };

const TYPE_PLACEHOLDERS = MODE === 'inside'
  ? {
      avoidable: 'e.g. Argument, close call, words that stuck with me…',
      fertile: 'e.g. Walked away instead of snapping, took a breath first…',
      observed: 'e.g. Someone checked in on me, I helped cool things down…'
    }
  : {
      avoidable: 'e.g. Forgot to save, spoke harshly…',
      fertile: 'e.g. Tried a new approach, missed the mark…',
      observed: 'What did I see? What lesson applies to me?'
    };

function getTypeLabel(type) {
  const t = type || 'avoidable';
  if (MODE === 'inside') {
    if (t === 'fertile') return '✶ SHIFT';
    if (t === 'observed') return '👁 SUPPORT';
    return '⚠ HEAT';
  }
  if (t === 'fertile') return '✶ FERTILE';
  if (t === 'observed') return '👁 OBSERVED';
  return '⚠ AVOIDABLE';
}
const periodTabs = document.querySelectorAll('.tab');
const statCount = document.getElementById('stat-count');
const statLabel = document.getElementById('stat-label');
const statAvg = document.getElementById('stat-avg');
const statExploration = document.getElementById('stat-exploration');
const statExplorationHint = document.getElementById('stat-exploration-hint');
const statExplorationSoWhat = document.getElementById('stat-exploration-so-what');
const statsBreakdown = document.getElementById('stats-breakdown');
const streakNote = document.getElementById('streak-note');
const headlineStatEl = document.getElementById('headline-stat');
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
const dayVsAverageEl = document.getElementById('day-vs-average');
const timeOfDayEl = document.getElementById('time-of-day');
const topPatternsTitleEl = document.getElementById('top-patterns-title');
const topPatternsEl = document.getElementById('top-patterns');
const morePatternsEl = document.getElementById('more-patterns');
const lineChartWrap = document.getElementById('line-chart-wrap');
const lineChartSvg = document.getElementById('line-chart-svg');
const lineChartLegend = document.getElementById('line-chart-legend');
const lineChartEmpty = document.getElementById('line-chart-empty');
const historyFilters = document.getElementById('history-filters');
const exportCsvBtn = document.getElementById('btn-export-csv');
const exportJsonBtn = document.getElementById('btn-export-json');
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
const firstTimeNudge = document.getElementById('first-time-nudge');
const upgradeCards = document.getElementById('upgrade-cards');
const unlockedBadge = document.getElementById('unlocked-badge');
const btnBuy = document.getElementById('btn-buy');
const paypalButtonContainer = document.getElementById('paypal-button-container');
const btnUnlockAfterPay = document.getElementById('btn-unlock-after-pay');
const btnBuyUnlocked = document.getElementById('btn-buy-unlocked');
const microGoalInput = document.getElementById('micro-goal-input');
const microGoalResult = document.getElementById('micro-goal-result');
const weeklyDigestEl = document.getElementById('weekly-digest');
const weeklyDigestBlock = document.getElementById('weekly-digest-block');
const reflectionContextPrompt = document.getElementById('reflection-context-prompt');
const btnTheme = document.getElementById('btn-theme');
const btnShareImage = document.getElementById('btn-share-image');
const reminderCheckbox = document.getElementById('reminder-checkbox');

const REFLECTIONS_KEY = MODE === 'inside' ? 'mistake-tracker-reflections-inside' : 'mistake-tracker-reflections';
const MICRO_GOAL_KEY = MODE === 'inside' ? 'mistake-tracker-micro-goal-inside' : 'mistake-tracker-micro-goal';
const THEME_KEY = 'mistake-tracker-theme';
const REMINDER_KEY = MODE === 'inside' ? 'mistake-tracker-reminder-inside' : 'mistake-tracker-reminder';
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
  if (cantTellBtn) cantTellBtn.disabled = atLimit;
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
      reflectionNote.textContent = MODE === 'inside'
        ? 'At the end of the day, write one line for each: what raised the heat (and how to cool it), and a shift you’re glad you made.'
        : 'At the end of the day, write one line for each: an avoidable pattern to reduce, and a fertile risk you’re glad you took.';
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
      reflectionNote.textContent = MODE === 'inside'
        ? 'At the end of the day, write one line for each: what raised the heat (and how to cool it), and a shift you’re glad you made.'
        : 'At the end of the day, write one line for each: an avoidable pattern to reduce, and a fertile risk you’re glad you took.';
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
  const avoidLabel = MODE === 'inside' ? 'Heat' : 'Avoidable';
  const fertileLabel = MODE === 'inside' ? 'Shift' : 'Fertile';
  let text = 'Yesterday — ';
  if (y.avoidable) {
    text += avoidLabel + ': ' + y.avoidable;
  }
  if (y.fertile) {
    if (y.avoidable) text += ' · ';
    text += fertileLabel + ': ' + y.fertile;
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

function getMonthBounds(offsetMonths) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
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

  if (statCount) statCount.textContent = count;
  if (statLabel) statLabel.textContent = getPeriodLabel(currentPeriod);
  if (statAvg) statAvg.textContent = avg;

  if (statsBreakdown) {
    if (count === 0) {
      statsBreakdown.textContent = '';
    } else {
      if (MODE === 'inside') {
        statsBreakdown.textContent =
          'Heat: ' + avoidableCount +
          ' · Shift: ' + fertileCount +
          ' · Support: ' + observedCount;
      } else {
        statsBreakdown.textContent =
          'Avoidable: ' + avoidableCount +
          ' · Fertile: ' + fertileCount +
          ' · Observed: ' + observedCount;
      }
    }
  }

  if (statsNote) {
    if (count === 0) {
      statsNote.textContent = MODE === 'inside'
        ? "No moments logged this period. It’s okay to start small—one heat, shift, or support moment is enough."
        : "No mistakes logged this period. That's okay—just check that you're still exploring and learning.";
    } else if (MODE === 'inside') {
      statsNote.textContent =
        avoidableCount + " heat (watch for patterns) · " +
        fertileCount + " shifts (different choices) · " +
        observedCount + " support (given, received, or seen)";
    } else {
      statsNote.textContent =
        avoidableCount + " avoidable (aim to reduce) · " +
        fertileCount + " fertile (valuable experiments)";
    }
  }

  if (streakNote) {
    const streak = getCurrentStreak();
    const daysSince = getDaysSinceLastLog();
    if (streak > 0) {
      if (streak === 1) streakNote.textContent = "You've logged today — that's one day in a row.";
      else streakNote.textContent = "You've logged " + streak + " days in a row. Keep it up.";
    } else if (entries.length > 0 && daysSince !== null && daysSince > 0) {
      streakNote.textContent = "Last log was " + daysSince + " day" + (daysSince === 1 ? "" : "s") + " ago. A quick check-in can help.";
    } else {
      streakNote.textContent = '';
    }
  }

  if (headlineStatEl) {
    const headline = getHeadlineStat();
    headlineStatEl.textContent = headline || '';
    headlineStatEl.classList.toggle('hidden', !headline);
  }

  // Exploration / shift index: fertile ÷ (avoidable + fertile)
  if (statExploration) {
    const primaryTotal = avoidableCount + fertileCount;
    if (primaryTotal === 0) {
      statExploration.textContent = '—';
      if (statExplorationHint) {
        statExplorationHint.textContent = MODE === 'inside'
          ? 'shift ÷ (heat + shift)'
          : 'fertile ÷ (avoidable + fertile)';
      }
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = '';
    } else {
      const ratio = fertileCount / primaryTotal;
      const pct = Math.round(ratio * 100);
      statExploration.textContent = pct + '%';
      if (statExplorationHint) {
        if (MODE === 'inside') {
          statExplorationHint.textContent = fertileCount + ' shift ÷ ' + primaryTotal + ' (heat + shift)';
        } else {
          statExplorationHint.textContent = fertileCount + ' fertile ÷ ' + primaryTotal + ' (avoidable + fertile)';
        }
      }
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = getExplorationSoWhat(pct);
    }
  }
  renderTrends();
  renderStatsTableAndLineChart();
  renderProgress();
  renderAdditionalInsights(filtered);
  renderWeeklyDigest();
  renderMicroGoal();
  setContextReflectionPrompt(filtered);
  renderAutoReflection();
}

function getExplorationSoWhat(pct) {
  if (MODE === 'inside') {
    if (pct >= 70) return 'Most of what you’re logging is shift — lots of different choices.';
    if (pct >= 50) return 'Good mix of heat and shift. Notice what helps you choose differently.';
    if (pct >= 30) return 'Some shifts showing up. You can build on those.';
    if (pct >= 10) return 'A few shifts. Even one small different choice matters.';
    if (pct > 0) return 'One shift is better than none. Name what helped.';
    return 'Look for one small shift today — it can be very simple.';
  } else {
    if (pct >= 70) return 'Lots of experimenting.';
    if (pct >= 50) return 'Good mix of risk and care.';
    if (pct >= 30) return 'Room to add more experiments.';
    if (pct >= 10) return 'Aim for more fertile mistakes.';
    if (pct > 0) return 'One small experiment can help.';
    return 'Try one stretch today.';
  }
}

function getWeeklyDigestSentence() {
  const days = getDayCountsLastN(7);
  const withData = days.filter(d => d.total > 0);
  if (withData.length < 2) return '';
  const avoidableLabel = MODE === 'inside' ? 'heat' : 'avoidable';
  const fertileLabel = MODE === 'inside' ? 'shift' : 'fertile';
  let best = null;
  days.forEach(d => {
    if (d.total <= 0) return;
    const ratio = d.fertile / d.total;
    if (!best || ratio > best.ratio) best = { ratio, dayStart: d.dayStart };
  });
  if (best) {
    const date = new Date(best.dayStart);
    const dayName = date.toLocaleDateString([], { weekday: 'long' });
    return "This week your best " + fertileLabel + " day was " + dayName + ".";
  }
  const totalAvoidable = days.reduce((s, d) => s + d.avoidable, 0);
  const totalFertile = days.reduce((s, d) => s + d.fertile, 0);
  if (totalAvoidable > totalFertile && totalAvoidable > 0)
    return "This week: more " + avoidableLabel + " than " + fertileLabel + ". One small experiment tomorrow can shift the balance.";
  return "This week you logged across " + withData.length + " days. Look for one pattern to adjust.";
}

function renderWeeklyDigest() {
  if (!weeklyDigestEl || !weeklyDigestBlock) return;
  const sentence = getWeeklyDigestSentence();
  weeklyDigestEl.textContent = sentence;
  weeklyDigestBlock.classList.toggle('hidden', !sentence);
}

function getTodayDateKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function loadMicroGoal() {
  try {
    const raw = localStorage.getItem(MICRO_GOAL_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data[getTodayDateKey()] || '';
  } catch (_) { return ''; }
}

function saveMicroGoal(text) {
  try {
    const raw = localStorage.getItem(MICRO_GOAL_KEY) || '{}';
    const data = JSON.parse(raw);
    data[getTodayDateKey()] = (text || '').trim();
    localStorage.setItem(MICRO_GOAL_KEY, JSON.stringify(data));
  } catch (_) {}
}

function evaluateMicroGoal(intention, todayAvoidable, todayFertile) {
  if (!intention || intention.length < 2) return null;
  const lower = intention.toLowerCase();
  const underMatch = lower.match(/under\s*(\d+)/) || lower.match(/(\d+)\s*or\s*less/);
  if (underMatch && todayAvoidable <= parseInt(underMatch[1], 10)) return true;
  if (/\b(one\s+)?fertile\b|\b(one\s+)?experiment\b|\bone\s+shift\b/i.test(intention) && todayFertile >= 1) return true;
  if (/\bless\s+heat\b|\bless\s+avoidable\b/i.test(intention) && todayAvoidable <= todayFertile) return true;
  return false;
}

function renderMicroGoal() {
  if (!microGoalInput || !microGoalResult) return;
  microGoalInput.value = loadMicroGoal();
  const todayStart = getStartOfDay(Date.now());
  const todayEnd = todayStart + 86400000;
  const todayEntries = entries.filter(e => e.at >= todayStart && e.at < todayEnd);
  const todayAvoidable = todayEntries.filter(e => (e.type || 'avoidable') === 'avoidable').length;
  const todayFertile = todayEntries.filter(e => (e.type || 'avoidable') === 'fertile').length;
  const intention = (microGoalInput.value || '').trim();
  microGoalResult.textContent = '';
  if (!intention) return;
  const hit = evaluateMicroGoal(intention, todayAvoidable, todayFertile);
  if (todayEntries.length > 0) {
    if (hit) microGoalResult.textContent = "You hit it. Nice one.";
    else microGoalResult.textContent = "Tomorrow's another day.";
  }
}

function setContextReflectionPrompt(filtered) {
  if (!reflectionContextPrompt) return;
  reflectionContextPrompt.textContent = '';
  const dayMs = 86400000;
  const now = Date.now();
  const last7 = entries.filter(e => e.at >= now - 7 * dayMs);
  if (last7.length < 3) return;
  const byPeriod = { morning: 0, afternoon: 0, night: 0 };
  let avoidableInAfternoon = 0, totalAvoidable = 0;
  last7.forEach(e => {
    const h = new Date(e.at).getHours();
    if (h >= 5 && h < 12) byPeriod.morning++;
    else if (h >= 12 && h < 18) { byPeriod.afternoon++; if ((e.type || 'avoidable') === 'avoidable') avoidableInAfternoon++; }
    else byPeriod.night++;
    if ((e.type || 'avoidable') === 'avoidable') totalAvoidable++;
  });
  const fertileCount = last7.filter(e => (e.type || 'avoidable') === 'fertile').length;
  if (totalAvoidable >= 2 && avoidableInAfternoon >= totalAvoidable / 2) {
    reflectionContextPrompt.textContent = MODE === 'inside'
      ? "Most of your heat this week was in the afternoon. What often happens around that time?"
      : "Most of your avoidable entries this week were in the afternoon. What often happens around that time?";
    return;
  }
  if (fertileCount === 0 && last7.length >= 3) {
    reflectionContextPrompt.textContent = MODE === 'inside'
      ? "No shifts logged this week. What's one small different choice you could try tomorrow?"
      : "No fertile experiments this week. What's one small experiment you could try tomorrow?";
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
    if (type === 'fertile') badgeClass = 'badge-fertile';
    else if (type === 'observed') badgeClass = 'badge-observed';
    badge.className = 'badge ' + badgeClass;
    badge.textContent = getTypeLabel(type);
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

function getHeadlineStat() {
  const { thisWeek, lastWeek } = getThisWeekAndLastWeek();
  const streak = getCurrentStreak();
  const noun = MODE === 'inside' ? 'moments' : 'mistakes';
  if (streak >= 2) {
    return streak + '-day logging streak.';
  }
  if (thisWeek.total > 0 && lastWeek.total > 0 && lastWeek.avoidable > 0) {
    const pctChange = Math.round(((thisWeek.avoidable - lastWeek.avoidable) / lastWeek.avoidable) * 100);
    const avoidableLabel = MODE === 'inside' ? 'heat' : 'avoidable';
    if (pctChange < 0) return 'This week: ' + Math.abs(pctChange) + '% less ' + avoidableLabel + ' than last week.';
    if (pctChange > 0) return 'This week: ' + pctChange + '% more ' + avoidableLabel + ' than last week.';
  }
  if (thisWeek.total > 0 && lastWeek.total > 0 && thisWeek.exploration != null && lastWeek.exploration != null) {
    const diff = thisWeek.exploration - lastWeek.exploration;
    if (diff > 5) return MODE === 'inside' ? 'Higher shift index this week than last — more shift.' : 'More exploration this week than last — more fertile ' + noun + '.';
  }
  return '';
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
  const progressNoun = MODE === 'inside' ? 'moments' : 'mistakes';
  const renderWeekCard = (label, stats, isThisWeek) => {
    const card = document.createElement('div');
    card.className = 'progress-card' + (isThisWeek ? ' progress-card-current' : '');
    const title = document.createElement('span');
    title.className = 'progress-card-title';
    title.textContent = label;
    card.appendChild(title);
    const totalEl = document.createElement('span');
    totalEl.className = 'progress-card-total';
    totalEl.textContent = stats.total + ' ' + progressNoun;
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
  else if (thisWeek.total === 0 && lastWeek.total > 0) diffText = 'No ' + progressNoun + ' logged this week yet.';
  else if (totalDiff !== 0 || (explDiff !== null && explDiff !== 0)) {
    const parts = [];
    if (totalDiff < 0) parts.push('Fewer ' + progressNoun + ' than last week.');
    else if (totalDiff > 0) parts.push('More ' + progressNoun + ' than last week.');
    if (explDiff !== null && explDiff > 0) parts.push(MODE === 'inside' ? 'Higher shift index—more shift.' : 'Higher exploration—more fertile.');
    else if (explDiff !== null && explDiff < 0) parts.push(MODE === 'inside' ? 'Lower shift index than last week.' : 'Lower exploration than last week.');
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

/** Day stats including observed, for table and line chart (last n days). */
function getDayCountsLastNFull(n) {
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
    const total = avoidable + fertile + observed;
    const primary = avoidable + fertile;
    const exploration = primary > 0 ? Math.round((fertile / primary) * 100) : 0;
    result.push({
      dayStart,
      avoidable,
      fertile,
      observed,
      total,
      exploration
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

function renderStatsTableAndLineChart() {
  const col1 = MODE === 'inside' ? 'Heat' : 'Avoidable';
  const col2 = MODE === 'inside' ? 'Shift' : 'Fertile';
  const col3 = MODE === 'inside' ? 'Support' : 'Observed';
  const days = getDayCountsLastNFull(14);
  const hasAny = days.some(d => d.total > 0);

  if (lineChartWrap && lineChartSvg) {
    lineChartWrap.classList.toggle('hidden', !hasAny);
    if (lineChartEmpty) lineChartEmpty.classList.toggle('hidden', hasAny);
    if (!hasAny) {
      lineChartSvg.innerHTML = '';
      if (lineChartLegend) lineChartLegend.textContent = '';
      return;
    }
    const maxVal = Math.max(1, ...days.map(d => d.total));
    const pad = { top: 10, right: 10, bottom: 24, left: 28 };
    const w = 400;
    const h = 180;
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const n = days.length;
    const x = i => pad.left + (i / Math.max(1, n - 1)) * chartW;
    const y = v => pad.top + chartH - (v / maxVal) * chartH;

    lineChartSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    lineChartSvg.innerHTML = '';

    const toPath = function(getVal) {
      return days.map(function(d, i) { return getVal(d); }).reduce(function(acc, v, i) {
        return acc + (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(v).toFixed(1);
      }, '');
    };

    const colors = {
      avoidable: 'var(--danger-dim, #c53030)',
      fertile: 'var(--accent-dim, #2c7a7b)',
      observed: 'var(--text-muted, #718096)',
      total: 'var(--text, #e2e8f0)'
    };
    [
      { key: 'avoidable', getVal: d => d.avoidable },
      { key: 'fertile', getVal: d => d.fertile },
      { key: 'observed', getVal: d => d.observed },
      { key: 'total', getVal: d => d.total }
    ].forEach(function(serie) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', toPath(serie.getVal));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', colors[serie.key]);
      path.setAttribute('stroke-width', serie.key === 'total' ? 2 : 1.5);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      lineChartSvg.appendChild(path);
    });

    if (lineChartLegend) {
      const items = [
        { label: col1, color: 'var(--danger-dim, #a94a4a)' },
        { label: col2, color: 'var(--accent-dim, #2c7a7b)' },
        { label: col3, color: 'var(--text-muted, #718096)' },
        { label: 'Total', color: 'var(--text, #e2e8f0)' }
      ];
      lineChartLegend.innerHTML = '';
      items.forEach(function(item) {
        const span = document.createElement('span');
        span.className = 'legend-item';
        span.innerHTML = '<span class="legend-swatch" style="background:' + item.color + '"></span><span class="legend-label">' + item.label + '</span>';
        lineChartLegend.appendChild(span);
      });
    }
  }
}

function renderAdditionalInsights(filteredForCurrentPeriod) {
  // 1) Today vs recent average (7-day window)
  if (dayVsAverageEl) {
    const todayList = entries.filter(e => e.at >= getStartOfDay(Date.now()) && e.at < getStartOfDay(Date.now()) + 86400000);
    const todayCount = todayList.length;
    const dayCounts = getDayCountsLastN(7);
    const totalLast7 = dayCounts.reduce((sum, d) => sum + d.total, 0);
    const avgLast7 = (totalLast7 / 7).toFixed(1);
    const block = dayVsAverageEl.closest('.insight-block');
    if (todayCount === 0 && totalLast7 === 0) {
      dayVsAverageEl.textContent = '';
      if (block) block.classList.add('hidden');
    } else {
      if (block) block.classList.remove('hidden');
      const noun = MODE === 'inside' ? 'moments' : 'mistakes';
      let text = todayCount + ' ' + noun + ' today · avg ' + avgLast7 + '/day this week.';
      if (todayCount > avgLast7) text += ' Slightly busier than usual.';
      else if (todayCount < avgLast7) text += ' Lighter than your usual.';
      else text += ' Right in line with your week.';
      dayVsAverageEl.textContent = text;
    }
  }

  // 2) Time-of-day profile for current period
  if (timeOfDayEl) {
    const block = timeOfDayEl.closest('.insight-block');
    if (!filteredForCurrentPeriod || !filteredForCurrentPeriod.length) {
      timeOfDayEl.textContent = '';
      if (block) block.classList.add('hidden');
    } else {
      const bands = { morning: 0, afternoon: 0, night: 0 };
      filteredForCurrentPeriod.forEach(e => {
        const h = new Date(e.at).getHours();
        if (h >= 5 && h < 12) bands.morning += 1;
        else if (h >= 12 && h < 18) bands.afternoon += 1;
        else bands.night += 1;
      });
      const max = Math.max(bands.morning, bands.afternoon, bands.night);
      const noun = MODE === 'inside' ? 'moments' : 'mistakes';
      if (max === 0) {
        timeOfDayEl.textContent = '';
        if (block) block.classList.add('hidden');
      } else {
        if (block) block.classList.remove('hidden');
        let strongest = '';
        if (bands.morning === max) strongest = 'morning';
        else if (bands.afternoon === max) strongest = 'afternoon';
        else strongest = 'night';
        timeOfDayEl.textContent =
          'Most ' + noun + ' this period: ' + strongest + ' (' + bands.morning + ' am · ' + bands.afternoon + ' noon · ' + bands.night + ' pm).';
      }
    }
  }

  // 3) Top repeating patterns for current period (notes that repeat)
  if (topPatternsEl && topPatternsTitleEl) {
    const block = topPatternsEl.closest('.insight-block');
    topPatternsEl.innerHTML = '';
    if (!filteredForCurrentPeriod || !filteredForCurrentPeriod.length) {
      topPatternsTitleEl.textContent = '';
      if (block) block.classList.add('hidden');
    } else {
      const counts = new Map();
      filteredForCurrentPeriod.forEach(e => {
        const note = (e.note || '').trim();
        if (!note) return;
        const key = note.toLowerCase();
        const existing = counts.get(key) || { count: 0, sample: note };
        existing.count += 1;
        counts.set(key, existing);
      });
      const patterns = Array.from(counts.values())
        .filter(p => p.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      if (!patterns.length) {
        topPatternsTitleEl.textContent = '';
        if (block) block.classList.add('hidden');
      } else {
        if (block) block.classList.remove('hidden');
        topPatternsTitleEl.textContent = 'Notes you\'ve logged more than once:';
        patterns.forEach(p => {
          const li = document.createElement('li');
          li.className = 'entry-item';
          const noteSpan = document.createElement('span');
          noteSpan.className = 'note';
          noteSpan.textContent = '“' + p.sample + '”';
          const countSpan = document.createElement('span');
          countSpan.className = 'time';
          countSpan.textContent = p.count + '×';
          li.appendChild(noteSpan);
          li.appendChild(countSpan);
          topPatternsEl.appendChild(li);
        });
      }
    }
  }

  // 4) Ten extra pattern lines as chips
  if (morePatternsEl) {
    const block = morePatternsEl.closest('.insight-block');
    morePatternsEl.innerHTML = '';
    const lines = getMorePatternLines(filteredForCurrentPeriod);
    lines.forEach(function(text) {
      if (!text) return;
      const chip = document.createElement('span');
      chip.className = 'insight-chip';
      chip.textContent = text;
      morePatternsEl.appendChild(chip);
    });
    if (block) block.classList.toggle('hidden', lines.length === 0);
  }
}

function getMorePatternLines(filteredForCurrentPeriod) {
  const noun = MODE === 'inside' ? 'moments' : 'mistakes';
  const avoidableLabel = MODE === 'inside' ? 'heat' : 'avoidable';
  const fertileLabel = MODE === 'inside' ? 'shift' : 'fertile';
  const observedLabel = MODE === 'inside' ? 'support' : 'observed';
  const dayMs = 86400000;
  const now = Date.now();
  const lines = [];

  // Last 30 days of entries for weekday/streak stats
  const last30Start = getStartOfDay(now - 29 * dayMs);
  const last30 = entries.filter(function(e) { return e.at >= last30Start; });

  // 1) Weekday with most avoidable (last 30 days)
  if (last30.length >= 3) {
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    last30.forEach(function(e) {
      if ((e.type || 'avoidable') === 'avoidable') {
        const d = new Date(e.at);
        byWeekday[d.getDay()]++;
      }
    });
    const max = Math.max.apply(null, byWeekday);
    if (max > 0) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const idx = byWeekday.indexOf(max);
      lines.push('Most ' + avoidableLabel + ' on ' + days[idx] + ' (' + max + ')');
    }
  }

  // 2) Weekend vs weekday average (last 30 days)
  if (last30.length >= 5) {
    let weekend = 0, weekendDays = 0, weekday = 0, weekdayDays = 0;
    for (let i = 0; i < 30; i++) {
      const dayStart = getStartOfDay(now - i * dayMs);
      const dayEnd = dayStart + dayMs;
      const dayEntries = last30.filter(function(e) { return e.at >= dayStart && e.at < dayEnd; });
      const d = new Date(dayStart);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) { weekend += dayEntries.length; weekendDays++; }
      else { weekday += dayEntries.length; weekdayDays++; }
    }
    const weekendAvg = weekendDays ? (weekend / weekendDays).toFixed(1) : '0';
    const weekdayAvg = weekdayDays ? (weekday / weekdayDays).toFixed(1) : '0';
    lines.push('Weekend ' + weekendAvg + '/day · weekday ' + weekdayAvg + '/day');
  }

  // 3) Peak hour in current period
  if (filteredForCurrentPeriod && filteredForCurrentPeriod.length >= 2) {
    const byHour = new Array(24);
    for (let h = 0; h < 24; h++) byHour[h] = 0;
    filteredForCurrentPeriod.forEach(function(e) {
      byHour[new Date(e.at).getHours()]++;
    });
    const maxH = Math.max.apply(null, byHour);
    if (maxH > 0) {
      const peakHour = byHour.indexOf(maxH);
      const hourStr = peakHour === 12 ? '12pm' : peakHour === 0 ? '12am' : peakHour < 12 ? peakHour + 'am' : (peakHour - 12) + 'pm';
      lines.push('Peak time: ' + hourStr + ' (' + maxH + ')');
    }
  }

  // 4) Dominant type for each of last 7 days (one-line summary)
  const last7Days = getDayCountsLastN(7);
  const withData = last7Days.filter(function(d) { return d.total > 0; });
  if (withData.length >= 2) {
    const dayLabels = [];
    last7Days.forEach(function(d, i) {
      const date = new Date(d.dayStart);
      const label = date.toLocaleDateString([], { weekday: 'short' });
      if (d.total === 0) dayLabels.push(label + ':—');
      else if (d.avoidable >= d.fertile && d.avoidable > 0) dayLabels.push(label + ':' + avoidableLabel);
      else if (d.fertile > 0) dayLabels.push(label + ':' + fertileLabel);
      else dayLabels.push(label + ':—');
    });
    lines.push('This week: ' + dayLabels.join(' · '));
  }

  // 5) Longest streak of days with at least 1 avoidable (last 30)
  if (last30.length >= 2) {
    let streak = 0, maxStreak = 0;
    for (let i = 0; i < 30; i++) {
      const dayStart = getStartOfDay(now - i * dayMs);
      const dayEnd = dayStart + dayMs;
      const dayEntries = last30.filter(function(e) { return e.at >= dayStart && e.at < dayEnd; });
      const hasAvoidable = dayEntries.some(function(e) { return (e.type || 'avoidable') === 'avoidable'; });
      if (hasAvoidable) { streak++; maxStreak = Math.max(maxStreak, streak); }
      else streak = 0;
    }
    if (maxStreak > 0) lines.push(maxStreak + ' days in a row with ' + avoidableLabel);
  }

  // 6) Improvement streak: consecutive days (from today back) where avoidable ≤ previous day (last 7)
  if (last7Days.filter(function(d) { return d.total > 0; }).length >= 2) {
    let streakDays = 1;
    for (let i = last7Days.length - 1; i > 0; i--) {
      if (last7Days[i].avoidable <= last7Days[i - 1].avoidable) streakDays++;
      else break;
    }
    if (streakDays > 1) lines.push(streakDays + ' days improving (' + avoidableLabel + ' ↓)');
  }

  // 7) Empty note rate % in period
  if (filteredForCurrentPeriod && filteredForCurrentPeriod.length > 0) {
    const withNote = filteredForCurrentPeriod.filter(function(e) { return (e.note || '').trim().length > 0; });
    const pct = Math.round((1 - withNote.length / filteredForCurrentPeriod.length) * 100);
    if (pct > 0) lines.push(pct + '% quick logs (no note)');
    else lines.push('Every entry has a note');
  }

  // 8) Average note length by type (avoidable vs fertile) in period
  if (filteredForCurrentPeriod && filteredForCurrentPeriod.length >= 2) {
    let avoidableLen = 0, avoidableN = 0, fertileLen = 0, fertileN = 0;
    filteredForCurrentPeriod.forEach(function(e) {
      const len = (e.note || '').trim().length;
      const t = e.type || 'avoidable';
      if (t === 'avoidable') { avoidableLen += len; avoidableN++; }
      else if (t === 'fertile') { fertileLen += len; fertileN++; }
    });
    if (avoidableN > 0 && fertileN > 0) {
      const aAvg = Math.round(avoidableLen / avoidableN);
      const fAvg = Math.round(fertileLen / fertileN);
      lines.push('Note length: ' + avoidableLabel + ' ' + aAvg + ' · ' + fertileLabel + ' ' + fAvg + ' chars');
    }
  }

  // 9) Last 7 days vs previous 7 days (rolling)
  const prev7Start = getStartOfDay(now - 14 * dayMs);
  const prev7End = getStartOfDay(now - 7 * dayMs);
  const this7 = entries.filter(function(e) { return e.at >= prev7End; });
  const prev7 = entries.filter(function(e) { return e.at >= prev7Start && e.at < prev7End; });
  if (this7.length + prev7.length >= 3) {
    const thisTotal = this7.length;
    const prevTotal = prev7.length;
    const diff = thisTotal - prevTotal;
    let msg = 'Last 7 days: ' + thisTotal + ' ' + noun + '. Previous 7: ' + prevTotal + '.';
    if (diff > 0) msg += ' ↑ vs last week';
    else if (diff < 0) msg += ' ↓ vs last week';
    else msg += ' (same as last week)';
    lines.push(msg);
  }

  // 10) Observed share % in period
  if (filteredForCurrentPeriod && filteredForCurrentPeriod.length > 0) {
    const observed = filteredForCurrentPeriod.filter(function(e) { return e.type === 'observed'; }).length;
    const pct = Math.round((observed / filteredForCurrentPeriod.length) * 100);
    lines.push(pct + '% ' + observedLabel);
  }

  return lines;
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

function getDaysSinceLastLog() {
  if (!entries || entries.length === 0) return null;
  const dayMs = 86400000;
  const now = Date.now();
  const todayStart = getStartOfDay(now);
  const sorted = entries.slice().sort((a, b) => b.at - a.at);
  const lastAt = sorted[0].at;
  if (lastAt >= todayStart) return 0;
  return Math.floor((todayStart - lastAt) / dayMs);
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
  try {
    getSupabase()
      .from(ENTRIES_TABLE)
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

let _supabaseClient = null;

function getSupabase() {
  if (!SHARING_ENABLED) {
    throw new Error('Sharing is not enabled (missing Supabase config).');
  }
  if (typeof supabase === 'undefined') {
    throw new Error('Supabase client library did not load.');
  }
  if (!_supabaseClient) {
    _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabaseClient;
}

/** Send an anonymous event for your analytics (purchase clicks, unlock, first visit). No PII. */
function trackEvent(eventType) {
  if (!SHARING_ENABLED || typeof supabase === 'undefined') return;
  try {
    const payload = {
      event_type: eventType,
      mode: MODE,
      created_at: new Date().toISOString()
    };
    if (typeof getOrCreateAnonId === 'function') payload.anonymous_id = getOrCreateAnonId();
    getSupabase().from(EVENTS_TABLE).insert(payload).then(() => {}).catch(() => {});
  } catch (_) {}
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
      shareStatus.textContent = 'Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js to enable sharing.';
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
    if (shareStatus) {
      shareStatus.textContent = 'Failed: ' + (isUnregisteredKey ? 'Unregistered API key' : msg);
      shareStatus.className = 'share-status error';
    }
  } finally {
    if (btnShare) btnShare.disabled = false;
  }
}

function cantTellAdd() {
  if (isAtLimit()) return;
  const type = getSelectedType();
  const scope = type === 'observed' ? 'observed' : 'personal';
  const entry = { at: Date.now(), note: "I couldn't tell", type, scope };
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
  a.download = MODE === 'inside' ? 'slipup-moments.csv' : 'mistakes.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportBackupJson() {
  const rawReflections = localStorage.getItem(REFLECTIONS_KEY);
  let reflections = {};
  try {
    if (rawReflections) reflections = JSON.parse(rawReflections);
  } catch (_) {}
  const backup = {
    exportedAt: new Date().toISOString(),
    mode: MODE,
    entries,
    reflections
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'slipup-backup.json';
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
  const MAX_OTHER_RESULTS = 5;
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
    if (sharedList) sharedList.innerHTML = '';
    if (sharedEmpty) {
      sharedEmpty.classList.remove('hidden');
      sharedEmpty.textContent = 'Could not load shared results.';
    }
    return;
  }
  sharedEmpty.classList.toggle('hidden', (data && data.length) > 0);
  if (!data || data.length === 0) {
    if (sharedList) sharedList.innerHTML = '';
    if (sharedEmpty) sharedEmpty.textContent = "No shared results yet. Share yours above!";
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
  if (sharedList) {
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
  }
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
      .from(ENTRIES_TABLE)
      .select('id, note, type, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    sharedEntriesList.innerHTML = '';
    const list = data || [];
    sharedEntriesEmpty.classList.toggle('hidden', list.length > 0);
    const emptyMsg = MODE === 'inside' ? "No shared moments yet. Add one to share yours." : "No shared entries yet. Add a mistake to share yours.";
    sharedEntriesEmpty.textContent = list.length === 0 ? emptyMsg : "";

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
      if (sharedFertilePct != null) parts.push(MODE === 'inside' ? 'Recent shared: ' + sharedFertilePct + '% shift.' : 'Recent shared entries: ' + sharedFertilePct + '% fertile.');
      communityComparison.textContent = parts.length ? parts.join(' ') : '';
    }

    if (communityEntriesTrend) {
      if (!list.length) {
        communityEntriesTrend.textContent = '';
      } else {
        const aLabel = MODE === 'inside' ? 'heat' : 'avoidable';
        const fLabel = MODE === 'inside' ? 'shift' : 'fertile';
        const oLabel = MODE === 'inside' ? 'support' : 'observed';
        communityEntriesTrend.textContent =
          'Last ' + list.length + ' shared: ' +
          avoidable + ' ' + aLabel + ' · ' +
          fertile + ' ' + fLabel + ' · ' +
          observed + ' ' + oLabel + '.';
      }
    }

    list.forEach(row => {
      const li = document.createElement('li');
      li.className = 'entry-item';
      const badge = document.createElement('span');
      const type = row.type || 'avoidable';
      let badgeClass = 'badge-avoidable';
      if (type === 'fertile') badgeClass = 'badge-fertile';
      else if (type === 'observed') badgeClass = 'badge-observed';
      badge.className = 'badge ' + badgeClass;
      badge.textContent = getTypeLabel(type);
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
      sharedEntriesEmpty.textContent = MODE === 'inside' ? "Could not load everyone's moments. Check config and try again." : "Could not load everyone's entries. Check config and try again.";
      sharedEntriesEmpty.classList.remove('hidden');
    }
  }
}

function showCommunityEntriesSetupMessage() {
  if (!sharedEntriesList || !sharedEntriesEmpty) return;
  sharedEntriesList.innerHTML = '';
  sharedEntriesEmpty.textContent = MODE === 'inside' ? "Set up Supabase in config.js to see everyone's moments. See README." : "Set up Supabase in config.js to see everyone's entries. See README.";
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

if (cantTellBtn) cantTellBtn.addEventListener('click', cantTellAdd);

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
if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', exportBackupJson);
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

try {
  if (!localStorage.getItem('slipup_first_visit_sent')) {
    trackEvent('first_visit');
    localStorage.setItem('slipup_first_visit_sent', '1');
  }
} catch (_) {}

setTimeout(function() {
  if (addNoteInput && typeof addNoteInput.focus === 'function') addNoteInput.focus();
}, 300);

try {
  localStorage.setItem('slipup-visited', '1');
} catch (_) {}
var addToHomeBanner = document.getElementById('add-to-home-banner');
var addToHomeDismiss = document.getElementById('add-to-home-dismiss');
if (addToHomeBanner && addToHomeDismiss) {
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var dismissed = localStorage.getItem('slipup-dismiss-add-to-home') === '1';
  if (!isStandalone && !dismissed && entries.length > 0) addToHomeBanner.classList.remove('hidden');
  addToHomeDismiss.addEventListener('click', function() {
    try { localStorage.setItem('slipup-dismiss-add-to-home', '1'); } catch (_) {}
    addToHomeBanner.classList.add('hidden');
  });
}

if (btnBuy && PAYMENT_URL) {
  btnBuy.href = PAYMENT_URL;
  btnBuy.classList.remove('hidden');
} else if (btnBuy) {
  btnBuy.classList.add('hidden');
}
if (btnBuy) {
  btnBuy.addEventListener('click', function(e) {
    trackEvent('purchase_button_clicked');
    if (!PAYMENT_URL) e.preventDefault();
    else setPaymentLinkClicked();
    if (PAYMENT_URL) setTimeout(updateUpgradeUI, 0);
  });
}
if (btnBuyUnlocked) {
  btnBuyUnlocked.addEventListener('click', function() {
    trackEvent('purchase_button_clicked');
    setPaymentLinkClicked();
    setTimeout(updateUpgradeUI, 0);
  });
}

if (btnUnlockAfterPay) {
  btnUnlockAfterPay.addEventListener('click', function() {
    trackEvent('unlock_button_clicked');
    setUnlocked();
  });
}

const THEME_ORDER = ['calm', 'focus', 'warm'];

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'calm';
  document.body.classList.remove('theme-focus', 'theme-warm');
  if (theme === 'focus') {
    document.body.classList.add('theme-focus');
    if (btnTheme) btnTheme.textContent = 'Focus';
  } else if (theme === 'warm') {
    document.body.classList.add('theme-warm');
    if (btnTheme) btnTheme.textContent = 'Warm';
  } else {
    if (btnTheme) btnTheme.textContent = 'Calm';
  }
}

if (btnTheme) {
  btnTheme.addEventListener('click', function() {
    const current = localStorage.getItem(THEME_KEY) || 'calm';
    const idx = THEME_ORDER.indexOf(current);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme();
  });
}
applyTheme();

if (microGoalInput) {
  microGoalInput.addEventListener('blur', function() {
    saveMicroGoal(microGoalInput.value);
    renderMicroGoal();
  });
}

function shareAsImage() {
  const filtered = filterByPeriod('week');
  const count = filtered.length;
  const avoidableCount = filtered.filter(e => (e.type || 'avoidable') === 'avoidable').length;
  const fertileCount = filtered.filter(e => (e.type || 'avoidable') === 'fertile').length;
  const primary = avoidableCount + fertileCount;
  const exploration = primary > 0 ? Math.round((fertileCount / primary) * 100) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  const bg = '#151b20';
  const text = '#eef3f7';
  const muted = '#8f9ba7';
  const accent = '#3fb6a8';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 400, 220);
  ctx.fillStyle = text;
  ctx.font = 'bold 22px "DM Sans", system-ui, sans-serif';
  ctx.fillText('SlipUp', 24, 44);
  ctx.fillStyle = muted;
  ctx.font = '14px "DM Sans", system-ui, sans-serif';
  ctx.fillText('This week', 24, 68);
  ctx.fillStyle = text;
  ctx.font = '32px "JetBrains Mono", monospace';
  ctx.fillText(String(count), 24, 118);
  ctx.fillStyle = muted;
  ctx.font = '14px "DM Sans", system-ui, sans-serif';
  ctx.fillText(MODE === 'inside' ? 'moments' : 'entries', 24, 142);
  ctx.fillStyle = accent;
  ctx.font = '24px "JetBrains Mono", monospace';
  ctx.fillText(exploration + '%', 24, 182);
  ctx.fillStyle = muted;
  ctx.fillText(MODE === 'inside' ? 'shift' : 'exploration', 24, 206);
  ctx.fillStyle = muted;
  ctx.font = '12px "DM Sans", system-ui, sans-serif';
  ctx.fillText('slipup.io', 400 - 24 - ctx.measureText('slipup.io').width, 214);
  try {
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'slipup-this-week.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (_) {}
}

if (btnShareImage) btnShareImage.addEventListener('click', shareAsImage);

function scheduleReminderNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const target = new Date(now);
  target.setHours(20, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const ms = target.getTime() - now.getTime();
  setTimeout(function() {
    if (localStorage.getItem(REMINDER_KEY) !== 'true') return;
    try {
      new Notification('SlipUp', { body: 'Time for a quick look at your day.', icon: '/manifest.json' });
    } catch (_) {}
    scheduleReminderNotification();
  }, Math.min(ms, 2147483647));
}

if (reminderCheckbox) {
  reminderCheckbox.checked = localStorage.getItem(REMINDER_KEY) === 'true';
  reminderCheckbox.addEventListener('change', function() {
    const enabled = reminderCheckbox.checked;
    localStorage.setItem(REMINDER_KEY, enabled ? 'true' : 'false');
    if (enabled) {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(function(p) {
          if (p === 'granted') scheduleReminderNotification();
        });
      } else if (Notification.permission === 'granted') scheduleReminderNotification();
    }
  });
  if (reminderCheckbox.checked && 'Notification' in window && Notification.permission === 'granted') scheduleReminderNotification();
}

