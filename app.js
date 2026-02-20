// Mode: "personal" (default) or "inside" (SlipUp Inside)
const MODE = (typeof window !== 'undefined' && window.SLIPUP_MODE) || 'personal';

const STORAGE_KEY = MODE === 'inside' ? 'mistake-tracker-entries-inside' : 'mistake-tracker-entries';
const ANON_ID_KEY = MODE === 'inside' ? 'mistake-tracker-anon-id-inside' : 'mistake-tracker-anon-id';
let stateEventSessionId = null;

const CONFIG = (typeof window !== 'undefined' && window.MISTAKE_TRACKER_CONFIG) || {};
// Supabase: table names (override in config with SUPABASE_STATS_TABLE / SUPABASE_ENTRIES_TABLE to use e.g. daily_summaries, shared_entries)
const STATS_TABLE = (CONFIG.SUPABASE_STATS_TABLE || '').trim() ||
  (MODE === 'inside' ? 'shared_stats_inside' : 'shared_stats');
const _entriesLegacy = (CONFIG.SUPABASE_ENTRIES_TABLE || '').trim() || 'shared_what_happened';
const ENTRIES_TABLE_PERSONAL = (CONFIG.SUPABASE_ENTRIES_TABLE_PERSONAL || '').trim() || _entriesLegacy;
const ENTRIES_TABLE_INSIDE = (CONFIG.SUPABASE_ENTRIES_TABLE_INSIDE || '').trim() || _entriesLegacy;
const ENTRIES_TABLE = MODE === 'inside' ? ENTRIES_TABLE_INSIDE : ENTRIES_TABLE_PERSONAL;
const CHART_TABLE = (CONFIG.SUPABASE_CHART_TABLE || '').trim() || 'shared_chart_counts';
const EVENTS_TABLE = 'slipup_events';
const STREAK_REFLECTIONS_TABLE = (CONFIG.SUPABASE_STREAK_REFLECTIONS_TABLE || '').trim() || 'streak_reflections';
const STATE_EVENTS_TABLE = (CONFIG.SUPABASE_STATE_EVENTS_TABLE || '').trim() || 'state_events';
const INTENTIONS_TABLE = (CONFIG.SUPABASE_INTENTIONS_TABLE || '').trim() || 'shared_intentions';
const TODAYS_REFLECTIONS_TABLE = (CONFIG.SUPABASE_TODAYS_REFLECTIONS_TABLE || '').trim() || 'todays_reflections';

let entries = [];
let currentPeriod = 'day';
let currentTypeFilter = 'all';
let lastEntry = null;
let lastShareAt = 0;

// Normalize Supabase URL: trim and remove trailing slash (avoids "Invalid API key" from wrong URL format)
const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (CONFIG.SUPABASE_ANON_KEY || '').trim();
const SHARING_ENABLED = SUPABASE_URL && SUPABASE_ANON_KEY;
/** Inside: group id from bootstrap (auth + group gate). Required for all Inside Supabase calls. */
function getInsideGroupId() {
  return (typeof window !== 'undefined' && window.SLIPUP_INSIDE_GROUP_ID) || null;
}
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
const addSyncStatus = document.getElementById('add-sync-status');
const typeInputs = document.querySelectorAll('input[name="mistake-type"]');
const typeHint = document.getElementById('type-hint');

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
const BIAS_DISPLAY = { harm: 'Harm', failed: 'Failed', different: 'Different', triggered: 'Triggered', unsure: 'Unsure' };
const BIAS_TITLES = { harm: 'It caused real harm', failed: 'It failed', different: "Different from what I'd do", triggered: 'I felt annoyed or triggered', unsure: "I'm not sure" };

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
  observed: 'e.g. Saw a pattern — my takeaway'
};
const periodTabs = document.querySelectorAll('.tab');
const statCount = document.getElementById('stat-count');
const statAvg = document.getElementById('stat-avg');
const statExploration = document.getElementById('stat-exploration');
const statExplorationHint = document.getElementById('stat-exploration-hint');
const statExplorationSoWhat = document.getElementById('stat-exploration-so-what');
const statCountSocial = document.getElementById('stat-count-social');
const statCountLabel = document.getElementById('stat-count-label');
const statLabelSocial = document.getElementById('stat-label-social');
const statAvgSocial = document.getElementById('stat-avg-social');
const statExplorationSocial = document.getElementById('stat-exploration-social');
const statExplorationHintSocial = document.getElementById('stat-exploration-hint-social');
const statExplorationSoWhatSocial = document.getElementById('stat-exploration-so-what-social');
const statsInsight = document.getElementById('stats-insight');
const statsInsightLabel = document.getElementById('stats-insight-label');
const statsInsightSocial = document.getElementById('stats-insight-social');
const statsInsightLabelSocial = document.getElementById('stats-insight-label-social');
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
const firstTimeNudge = document.getElementById('first-time-nudge');
const statsInsightChart = document.getElementById('stats-insight-chart');
const historyFilters = document.getElementById('history-filters');
const exportCsvBtn = document.getElementById('btn-export-csv');
const lineChartWrap = document.getElementById('line-chart-wrap');
const lineChartSvg = document.getElementById('line-chart-svg');
const lineChartLegend = document.getElementById('line-chart-legend');
const lineChartEmpty = document.getElementById('line-chart-empty');
const socialBlock = document.getElementById('social-block');
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
const communityEntriesCard = document.getElementById('community-entries-card');
const sharedEntriesList = document.getElementById('shared-entries-list');
const sharedEntriesEmpty = document.getElementById('shared-entries-empty');
const sharedEntriesError = document.getElementById('shared-entries-error');
const btnRefreshEntries = document.getElementById('btn-refresh-entries');
const btnSharedEntriesToggle = document.getElementById('btn-shared-entries-toggle');
const btnShowAllShared = document.getElementById('btn-show-all-shared');
const sharedEntriesFilters = document.getElementById('shared-entries-filters');
const btnAddFromCommunity = document.getElementById('btn-add-from-community');
const topBarAdd = document.getElementById('top-bar-add');
const topBarSlipups = document.getElementById('top-bar-slipups');
const topBarShare = document.getElementById('top-bar-share');
const topBarWorld = document.getElementById('top-bar-world');
const personalView = document.getElementById('personal-view');
const socialView = document.getElementById('social-view');
const globalCountChart = document.getElementById('global-count-chart');
const btnSharedTotal = document.getElementById('btn-shared-total');
const communityEntriesLastUpdated = document.getElementById('community-entries-last-updated');
const socialToShare = document.getElementById('social-to-share');
const socialToShareCount = document.getElementById('social-to-share-count');
const socialToShareLabel = document.getElementById('social-to-share-label');
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
const reflectionIntentionMatch = document.getElementById('reflection-intention-match');
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
const microGoalCharCount = document.getElementById('micro-goal-char-count');
const sharedIntentionsBlock = document.getElementById('shared-intentions-block');
const sharedIntentionsChart = document.getElementById('shared-intentions-chart');
const sharedIntentionsTableBody = document.getElementById('shared-intentions-table-body');
const sharedIntentionsTableWrap = document.getElementById('shared-intentions-table-wrap');
const sharedIntentionsLabel = document.getElementById('shared-intentions-label');
const microGoalHint = document.getElementById('micro-goal-hint');
const btnShareIntention = document.getElementById('btn-share-intention');
const btnViewOlderIntentions = document.getElementById('btn-view-older-intentions');
const weeklyDigest = document.getElementById('weekly-digest');
const weeklyDigestChart = document.getElementById('weekly-digest-chart');
const monthlyDigest = document.getElementById('monthly-digest');
const monthlyDigestChart = document.getElementById('monthly-digest-chart');
const dayVsAverage = document.getElementById('day-vs-average');
const dayVsAverageChart = document.getElementById('day-vs-average-chart');
const timeOfDay = document.getElementById('time-of-day');
const timeOfDayChart = document.getElementById('time-of-day-chart');
const topPatternsChart = document.getElementById('top-patterns-chart');
const morePatternsChart = document.getElementById('more-patterns-chart');
const biasCheckInsight = document.getElementById('bias-check-insight');
const biasCheckInsightBlock = document.getElementById('bias-check-insight-block');
const biasCheckPeriodBreakdown = document.getElementById('bias-check-period-breakdown');
const addToHomeBanner = document.getElementById('add-to-home-banner');
const addToHomeDismiss = document.getElementById('add-to-home-dismiss');
const reminderCheckbox = document.getElementById('reminder-checkbox');
const shareToGroupSection = document.getElementById('share-to-group-section');
const shareToGroupList = document.getElementById('share-to-group-list');
const btnShareToGroupSelectAll = document.getElementById('btn-share-to-group-select-all');
const btnShareToGroup = document.getElementById('btn-share-to-group');
const shareToGroupStatus = document.getElementById('share-to-group-status');

// How many rows to fetch for "Everyone's recent entries".
// Default: last 10. Toggle cycles: 10 → 20 → 50. "All shared": 200.
let sharedEntriesLimit = 10;
const SHARED_ENTRIES_LIMIT_ALL = 200;
let lastSharedEntries = [];
let lastSharedIntentionsItems = [];
let sharedEntriesTypeFilter = 'all';
let sharedEntriesThemeFilter = 'all';
/** Last intention pushed to Supabase this session (avoids duplicate inserts). */
let lastPushedIntention = '';
/** Set when user clicks Save in Bias Check; applied to next observed entry. */
let lastBiasCheckReason = null;
/** Global observed count from shared feed (set by fetchSharedEntries). */
let lastGlobalObservedCount = 0;

function isUnlocked() {
  return localStorage.getItem(UNLOCKED_KEY) === 'true';
}

/**
 * Element IDs gated behind payment: disabled until user pays ($5 link → I've paid).
 * Add any button/input ID to this array to gate it. Elements must support .disabled.
 * Rule: Each button with similar function (export / share data) must require "I've paid" first.
 * Enjoy full exports — your support helps SlipUp grow.
 */
const PAID_ONLY_ELEMENT_IDS = ['btn-export-csv', 'btn-export-reflections', 'btn-export-intentions', 'btn-export-feed', 'btn-download-global-patterns'];

var PAID_ONLY_TOOLTIP_LOCKED = 'Unlock to download — Purchase for $5, then click "I\'ve paid". Your support helps SlipUp grow. See Terms & Refund.';
var PAID_ONLY_TOOLTIP_UNLOCKED = '';

function updatePaidOnlyElements() {
  const unlocked = isUnlocked();
  PAID_ONLY_ELEMENT_IDS.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !unlocked;
      el.setAttribute('title', unlocked ? PAID_ONLY_TOOLTIP_UNLOCKED : PAID_ONLY_TOOLTIP_LOCKED);
    }
  });
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
  updatePaidOnlyElements();
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
// Prefer the active mood pill or top-bar theme.
function getCurrentTheme() {
  try {
    const active = document.querySelector('.mood-btn.active[data-theme]');
    if (active) {
      const t = active.getAttribute('data-theme');
      if (t === 'focus' || t === 'stressed' || t === 'curious' || t === 'tired') return t;
      if (t === 'calm') return 'calm';
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
  const today = all[key] || { avoidable: '', fertile: '', intentionMatch: '' };
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

  if (reflectionIntentionMatch) {
    const intention = loadMicroGoal();
    if (intention && intention.trim()) {
      reflectionIntentionMatch.classList.remove('hidden');
      const btns = reflectionIntentionMatch.querySelectorAll('.reflection-intention-btn');
      btns.forEach(function (btn) {
        btn.classList.toggle('selected', (btn.dataset.value || '') === (today.intentionMatch || ''));
      });
    } else {
      reflectionIntentionMatch.classList.add('hidden');
    }
  }

  updateReflectionCounters();
  renderYesterdayReflection();
  renderReflectionHistory();
}

function getTodayDayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function saveTodaysReflectionToSupabase() {
  if (!SHARING_ENABLED || !TODAYS_REFLECTIONS_TABLE) return;
  try {
    const client = getSupabase();
    const key = getTodayKey();
    const all = loadReflections();
    const today = all[key] || { avoidable: '', fertile: '', intentionMatch: '' };
    const dayStart = getStartOfDay(Date.now());
    const dayEnd = dayStart + 86400000 - 1;
    const dayEntries = entries.filter(e => e.at >= dayStart && e.at <= dayEnd);
    const avoidableCount = dayEntries.filter(e => (e.type || 'avoidable') === 'avoidable').length;
    const fertileCount = dayEntries.filter(e => (e.type || 'avoidable') === 'fertile').length;
    const observedCount = dayEntries.filter(e => (e.type || 'avoidable') === 'observed').length;
    const primary = avoidableCount + fertileCount;
    const explorationPct = primary > 0 ? Math.round((fertileCount / primary) * 100) : null;
    const payload = {
      anonymous_id: getOrCreateAnonId(),
      mode: MODE,
      day_date: getTodayDayDate(),
      avoidable: today.avoidable || null,
      fertile: today.fertile || null,
      intention_match: today.intentionMatch || null,
      avoidable_count: avoidableCount,
      fertile_count: fertileCount,
      observed_count: observedCount,
      exploration_pct: explorationPct
    };
    client.from(TODAYS_REFLECTIONS_TABLE).upsert(payload, {
      onConflict: 'anonymous_id,mode,day_date',
      ignoreDuplicates: false
    }).then(({ error }) => {
      if (error) console.warn('SlipUp: todays_reflections upsert failed', error);
    });
  } catch (e) {
    if (e.message && !e.message.includes('Sharing is not enabled')) console.warn('SlipUp: todays_reflections save failed', e);
  }
}

function updateReflection(field, value) {
  const key = getTodayKey();
  const all = loadReflections();
  const today = all[key] || { avoidable: '', fertile: '', intentionMatch: '' };
  today[field] = value;
  all[key] = today;
  saveReflections(all);
  saveTodaysReflectionToSupabase();
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
  logStateEvent('action', 'export_reflections');
  const all = loadReflections();
  const keys = Object.keys(all)
    .map(function (k) { return Number(k); })
    .filter(function (n) { return !isNaN(n); })
    .sort(function (a, b) { return a - b; }); // oldest first
  const rows = [];
  const header = MODE === 'inside'
    ? ['date', 'heat_or_avoidable', 'shift_support_or_fertile', 'intention_match']
    : ['date', 'avoidable', 'fertile', 'intention_match'];
  rows.push(header);
  keys.forEach(function (ts) {
    const day = all[String(ts)] || {};
    if (!day.avoidable && !day.fertile && !day.intentionMatch) return;
    const d = new Date(ts);
    const iso = d.toISOString().slice(0, 10);
    rows.push([iso, day.avoidable || '', day.fertile || '', day.intentionMatch || '']);
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
  const noun = MODE === 'inside' ? 'moments' : 'slip-ups';
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

  var dominantType = 'observed';
  if (count > 0) {
    if (fertileCount >= avoidableCount && fertileCount >= observedCount) dominantType = 'fertile';
    else if (avoidableCount >= fertileCount && avoidableCount >= observedCount) dominantType = 'avoidable';
    else dominantType = 'observed';
  }
  var typeClass = 'stat-card--' + dominantType;
  var cardsToType = document.querySelectorAll('.stats .stat-card:not(.stat-exploration)');
  cardsToType.forEach(function (card) {
    card.classList.remove('stat-card--avoidable', 'stat-card--fertile', 'stat-card--observed');
    card.classList.add(typeClass);
  });

  if (statCount) {
    const prev = statCount.textContent;
    statCount.textContent = count;
    if (prev !== String(count)) {
      statCount.classList.add('updated');
      setTimeout(function () { statCount.classList.remove('updated'); }, 450);
    }
  }
  if (statAvg) statAvg.textContent = avg;

  /* Stat foot: contextual bottom line on count & per-day cards */
  const statCountFoot = document.getElementById('stat-count-foot');
  const statAvgFoot = document.getElementById('stat-avg-foot');
  if (statCountFoot) {
    const streak = getCurrentStreak();
    const dayMs = 86400000;
    const todayStart = getStartOfDay(Date.now());
    const yesterdayStart = todayStart - dayMs;
    const yesterdayEnd = todayStart - 1;
    const yesterdayCount = entries.filter(e => e.at >= yesterdayStart && e.at <= yesterdayEnd).length;
    let foot = '';
    if (currentPeriod === 'day') {
      if (count === 0 && yesterdayCount === 0) foot = '';
      else if (count === 0) foot = MODE === 'inside' ? 'Quiet today — that\'s okay.' : 'Quiet today — that\'s okay.';
      else if (yesterdayCount === 0) foot = MODE === 'inside' ? 'First today.' : 'First today.';
      else if (count > yesterdayCount) foot = '↑' + (count - yesterdayCount) + ' from yesterday';
      else if (count < yesterdayCount) foot = '↓' + (yesterdayCount - count) + ' from yesterday';
      else foot = 'Same as yesterday';
    } else if (streak > 0 && count > 0) {
      if (streak === 1) foot = MODE === 'inside' ? 'Day one.' : 'Day one.';
      else if (streak < 7) foot = streak + ' days running';
      else foot = streak + '-day streak';
    } else if (topTheme && topThemeCount > 0 && count > 0) {
      const themeLabels = { calm: 'calm', focus: 'focused', stressed: 'stressed', curious: 'curious', tired: 'tired' };
      foot = 'mostly ' + (themeLabels[topTheme] || topTheme);
    }
    statCountFoot.textContent = foot;
  }
  if (statAvgFoot && days > 1) {
    const byDay = {};
    filtered.forEach(e => {
      const d = getStartOfDay(e.at);
      byDay[d] = (byDay[d] || 0) + 1;
    });
    const vals = Object.values(byDay);
    const peak = vals.length ? Math.max.apply(null, vals) : 0;
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let peakDay = null;
    Object.keys(byDay).forEach(ts => {
      if (byDay[ts] === peak) peakDay = dayNames[new Date(parseInt(ts, 10)).getDay()];
    });
    let foot = '';
    if (peak > 0 && parseFloat(avg) > 0) {
      if (peak > parseFloat(avg) && peakDay) foot = 'Peak ' + peak + ' on ' + peakDay;
      else if (peak === 1 && count === 1) foot = 'Steady';
      else foot = 'Steady pace';
    }
    statAvgFoot.textContent = foot;
  } else if (statAvgFoot) {
    statAvgFoot.textContent = '';
  }

  var countTitle = MODE === 'inside'
    ? 'Moments you logged in this period. Color reflects your mix of heat, shift, support — notice without blame.'
    : 'Slip-ups you logged in this period. Color reflects your mix of avoidable, fertile, observed — notice patterns without blame.';
  var avgTitle = MODE === 'inside'
    ? 'Average per day — helps you spot busy vs calm stretches.'
    : 'Average per day — helps you spot busy vs calm stretches.';
  var explTitle = MODE === 'inside'
    ? 'Share of shift vs heat — shift ÷ (heat + shift). Higher = more stretches, less tension.'
    : 'Share of fertile (experiments) vs avoidable (repeats). Higher = more risks that grow you.';
  var cards = document.querySelectorAll('.stats .stat-card');
  if (cards[0]) cards[0].setAttribute('title', countTitle);
  if (cards[1]) cards[1].setAttribute('title', avgTitle);
  if (cards[2]) cards[2].setAttribute('title', explTitle);

  if (statsInsightLabel) {
    statsInsightLabel.textContent = currentPeriod === 'day' ? 'Today' : currentPeriod === 'week' ? 'This week' : 'This month';
  }
  if (statsInsightLabelSocial) {
    statsInsightLabelSocial.textContent = currentPeriod === 'day' ? 'Today' : currentPeriod === 'week' ? 'This week' : 'This month';
  }
  // Social view stats (same values, different DOM)
  if (statCountSocial) statCountSocial.textContent = count;
  if (statCountLabel) statCountLabel.textContent = getPeriodLabel(currentPeriod);
  if (statLabelSocial) statLabelSocial.textContent = getPeriodLabel(currentPeriod);
  if (statAvgSocial) statAvgSocial.textContent = avg;

  const labels = MODE === 'inside'
    ? { avoidable: 'heat', fertile: 'shift', observed: 'support' }
    : { avoidable: 'avoidable', fertile: 'fertile', observed: 'observed' };
  const reduceHint = MODE === 'inside' ? 'to cool down' : 'to reduce';
  const fertileHint = MODE === 'inside' ? 'stretches' : 'experiments';

  if (statsInsight) {
    if (count === 0) {
      statsInsight.textContent = MODE === 'inside'
        ? "No moments yet. Add one when you're ready."
        : "Nothing logged yet. Add one when something comes up.";
    } else {
      const sep = '<span class="stats-insight-sep"> · </span>';
      const seg = function (type, n, text) {
        if (n === 0) return '';
        return '<span class="stats-insight-seg stats-insight-seg--' + type + '">' + escapeHtml(String(n)) + '</span> ' + escapeHtml(text);
      };
      const parts = [];
      if (avoidableCount > 0) {
        parts.push(seg('avoidable', avoidableCount, avoidableCount === 1 ? labels.avoidable + ' to learn from' : labels.avoidable + ' ' + reduceHint));
      }
      if (fertileCount > 0) {
        parts.push(seg('fertile', fertileCount, fertileCount === 1 ? labels.fertile + ' — nice' : labels.fertile + ' ' + fertileHint));
      }
      if (observedCount > 0) {
        parts.push(seg('observed', observedCount, observedCount === 1 ? labels.observed + ' noticed' : labels.observed));
      }
      let html = parts.join(sep);
      if (topTheme && topThemeCount > 0) {
        const themeLabels = { calm: 'calm', focus: 'focused', stressed: 'stressed', curious: 'curious', tired: 'tired' };
        const themeLabel = themeLabels[topTheme] || topTheme;
        html += (parts.length ? '<span class="stats-insight-sep"> — </span>' : '') + '<span class="stats-insight-mood">mostly ' + escapeHtml(themeLabel) + '</span>';
      }
      statsInsight.innerHTML = html;
    }
  }

  if (statsInsightSocial) {
    if (count === 0) {
      statsInsightSocial.textContent = MODE === 'inside'
        ? "No moments yet. Add one when you're ready."
        : "Nothing logged yet. Add one when something comes up.";
    } else {
      const sep = '<span class="stats-insight-sep"> · </span>';
      const seg = function (type, n, text) {
        if (n === 0) return '';
        return '<span class="stats-insight-seg stats-insight-seg--' + type + '">' + escapeHtml(String(n)) + '</span> ' + escapeHtml(text);
      };
      const parts = [];
      if (avoidableCount > 0) {
        parts.push(seg('avoidable', avoidableCount, avoidableCount === 1 ? labels.avoidable + ' to learn from' : labels.avoidable + ' ' + reduceHint));
      }
      if (fertileCount > 0) {
        parts.push(seg('fertile', fertileCount, fertileCount === 1 ? labels.fertile + ' — nice' : labels.fertile + ' ' + fertileHint));
      }
      if (observedCount > 0) {
        parts.push(seg('observed', observedCount, observedCount === 1 ? labels.observed + ' noticed' : labels.observed));
      }
      let html = parts.join(sep);
      if (topTheme && topThemeCount > 0) {
        const themeLabels = { calm: 'calm', focus: 'focused', stressed: 'stressed', curious: 'curious', tired: 'tired' };
        const themeLabel = themeLabels[topTheme] || topTheme;
        html += (parts.length ? '<span class="stats-insight-sep"> — </span>' : '') + '<span class="stats-insight-mood">mostly ' + escapeHtml(themeLabel) + '</span>';
      }
      statsInsightSocial.innerHTML = html;
    }
  }

  if (statsInsightChart) {
    renderStatsInsightChart(avoidableCount, fertileCount, observedCount);
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

  // Exploration index: fertile ÷ (avoidable + fertile)
  const statExplorationTip = document.getElementById('stat-exploration-tip');
  if (statExplorationTip) {
    statExplorationTip.title = MODE === 'inside'
      ? 'Share of shift vs heat — shift ÷ (heat + shift). Higher = more stretches, less tension.'
      : 'Share of fertile (experiments) vs avoidable (repeats). fertile ÷ total. Higher = more risks that grow you.';
  }
  if (statExploration) {
    const primaryTotal = avoidableCount + fertileCount;
    if (primaryTotal === 0) {
      statExploration.textContent = '—';
      if (statExplorationHint) statExplorationHint.textContent = MODE === 'inside' ? 'Share of shift vs heat' : 'Experiments vs repeats';
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = '';
    } else {
      const ratio = fertileCount / primaryTotal;
      const pct = Math.round(ratio * 100);
      statExploration.textContent = pct + '%';
      if (statExplorationHint) {
        if (pct === 0) {
          statExplorationHint.textContent = MODE === 'inside' ? 'No shifts yet' : 'No experiments yet';
        } else {
          statExplorationHint.textContent = MODE === 'inside'
            ? fertileCount + ' shift ÷ ' + primaryTotal + ' total'
            : fertileCount + ' fertile ÷ ' + primaryTotal + ' total';
        }
      }
      if (statExplorationSoWhat) statExplorationSoWhat.textContent = getExplorationSoWhat(pct);
    }
  }
  // Social view exploration index
  if (statExplorationSocial) {
    const primaryTotal = avoidableCount + fertileCount;
    if (primaryTotal === 0) {
      statExplorationSocial.textContent = '—';
      if (statExplorationHintSocial) statExplorationHintSocial.textContent = MODE === 'inside' ? 'Share of shift vs heat' : 'Experiments vs repeats';
      if (statExplorationSoWhatSocial) statExplorationSoWhatSocial.textContent = '';
    } else {
      const ratio = fertileCount / primaryTotal;
      const pct = Math.round(ratio * 100);
      statExplorationSocial.textContent = pct + '%';
      if (statExplorationHintSocial) {
        if (pct === 0) {
          statExplorationHintSocial.textContent = MODE === 'inside' ? 'No shifts yet' : 'No experiments yet';
        } else {
          statExplorationHintSocial.textContent = MODE === 'inside'
            ? fertileCount + ' shift ÷ ' + primaryTotal + ' total'
            : fertileCount + ' fertile ÷ ' + primaryTotal + ' total';
        }
      }
      if (statExplorationSoWhatSocial) statExplorationSoWhatSocial.textContent = getExplorationSoWhat(pct);
    }
  }
  renderTrends();
  renderLineChart();
  renderProgress();
  renderAutoReflection();
  renderMicroGoal();
  renderInsights();
  updateSocialToShare();
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

  const typeLabelsHist = MODE === 'inside'
    ? { avoidable: 'Heat', fertile: 'Shift', observed: 'Support' }
    : { avoidable: 'Avoidable', fertile: 'Fertile', observed: 'Observed' };
  const themeLabelsHist = { calm: 'Calm', focus: 'Focus', stressed: 'Stressed', curious: 'Curious', tired: 'Tired' };
  show.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'entry-item';
    const badge = document.createElement('span');
    const type = entry.type || 'avoidable';
    let badgeClass = 'badge-avoidable';
    if (type === 'fertile') badgeClass = 'badge-fertile';
    else if (type === 'observed') badgeClass = 'badge-observed';
    badge.className = 'badge ' + badgeClass;
    badge.textContent = typeLabelsHist[type] || typeLabelsHist.avoidable;
    const note = document.createElement('span');
    note.className = 'note' + (entry.note ? '' : ' empty');
    note.textContent = entry.note || "I couldn't tell";
    if (entry.note) {
      note.title = entry.note;
      note.dataset.fullNote = entry.note;
    }
    const theme = document.createElement('span');
    const t = entry.theme || 'calm';
    const tNorm = (t === 'warm') ? 'curious' : (t === 'focus' || t === 'stressed' || t === 'curious' || t === 'tired' ? t : 'calm');
    theme.className = 'theme theme--' + tNorm;
    theme.textContent = themeLabelsHist[tNorm] || themeLabelsHist.calm;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(entry.at);
    li.appendChild(badge);
    li.appendChild(note);
    if (type === 'observed' && entry.biasReason && BIAS_DISPLAY[entry.biasReason]) {
      const bias = document.createElement('span');
      bias.className = 'bias-reason bias-reason--' + entry.biasReason;
      bias.textContent = BIAS_DISPLAY[entry.biasReason];
      bias.title = 'Why: ' + (BIAS_TITLES[entry.biasReason] || '');
      li.appendChild(bias);
    }
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

function getThisMonthStats() {
  const now = new Date();
  const start = getStartOfMonth(now.getTime());
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = nextMonth.getTime();
  const inMonth = entries.filter(e => e.at >= start && e.at < end);
  const toStats = (list) => {
    let avoidable = 0;
    let fertile = 0;
    let observed = 0;
    list.forEach(e => {
      const t = e.type || 'avoidable';
      if (t === 'fertile') fertile++;
      else if (t === 'observed') observed++;
      else avoidable++;
    });
    const total = avoidable + fertile + observed;
    const primary = avoidable + fertile;
    const exploration = primary > 0 ? Math.round((fertile / primary) * 100) : null;
    return { avoidable, fertile, observed, total, exploration };
  };
  return toStats(inMonth);
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
  const aLabel = MODE === 'inside' ? 'heat' : 'avoidable';
  const fLabel = MODE === 'inside' ? 'shift' : 'fertile';
  const explLabel = MODE === 'inside' ? 'shift' : 'exploration';
  const explTip = MODE === 'inside'
    ? 'Share of shift vs heat — shift ÷ (heat + shift). Higher = more stretches, less tension.'
    : 'Share of fertile (experiments) vs avoidable (repeats). fertile ÷ total. Higher = more risks that grow you.';
  const noun = MODE === 'inside' ? 'moments' : 'slip-ups';

  const renderWeekCard = (label, stats, isThisWeek) => {
    const card = document.createElement('div');
    card.className = 'progress-card' + (isThisWeek ? ' progress-card-current' : '');
    const title = document.createElement('span');
    title.className = 'progress-card-title';
    title.textContent = label;
    card.appendChild(title);
    const totalEl = document.createElement('span');
    totalEl.className = 'progress-card-total';
    totalEl.textContent = stats.total + ' ' + noun;
    card.appendChild(totalEl);
    const primary = stats.avoidable + stats.fertile;
    if (primary > 0) {
      const breakdown = document.createElement('span');
      breakdown.className = 'progress-card-breakdown';
      breakdown.innerHTML = '<span class="progress-card-breakdown--avoidable">' + stats.avoidable + ' ' + aLabel + '</span> · <span class="progress-card-breakdown--fertile">' + stats.fertile + ' ' + fLabel + '</span>';
      card.appendChild(breakdown);
    }
    const explEl = document.createElement('span');
    explEl.className = 'progress-card-exploration';
    explEl.title = explTip;
    explEl.setAttribute('aria-label', 'What is ' + explLabel + '?');
    if (stats.exploration != null) {
      explEl.innerHTML = stats.exploration + '% ' + explLabel + '<span class="progress-expl-tip" aria-hidden="true">?</span>';
    } else {
      explEl.textContent = '—';
    }
    card.appendChild(explEl);
    return card;
  };
  progressCards.innerHTML = '';
  progressCards.appendChild(renderWeekCard('This week', thisWeek, true));
  progressCards.appendChild(renderWeekCard('Last week', lastWeek, false));

  const diff = document.createElement('div');
  diff.className = 'progress-diff';
  const totalDiff = thisWeek.total - lastWeek.total;
  const explDiff = (thisWeek.exploration != null && lastWeek.exploration != null)
    ? thisWeek.exploration - lastWeek.exploration
    : null;
  let diffText = '';
  if (lastWeek.total === 0 && thisWeek.total > 0) diffText = "You've started logging this week.";
  else if (thisWeek.total === 0 && lastWeek.total > 0) diffText = MODE === 'inside' ? 'No moments this week yet.' : 'No mistakes logged this week yet.';
  else if (totalDiff !== 0 || (explDiff !== null && explDiff !== 0)) {
    const parts = [];
    if (totalDiff < 0) parts.push('Fewer ' + noun + '.');
    else if (totalDiff > 0) parts.push('More ' + noun + '.');
    if (explDiff !== null && explDiff > 0) parts.push(MODE === 'inside' ? 'Higher shift—more stretches.' : 'Higher exploration—more fertile.');
    else if (explDiff !== null && explDiff < 0) parts.push(MODE === 'inside' ? 'Lower shift than last week.' : 'Lower exploration than last week.');
    diffText = parts.join(' ');
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
  const gridColor = 'rgba(255,255,255,0.05)';
  const labelColor = 'rgba(255,255,255,0.35)';
  const strokeW = 2.5;
  const dotR = 4;

  const series = [
    { key: 'avoidable', color: avoidableColor },
    { key: 'fertile', color: fertileColor },
    { key: 'observed', color: observedColor }
  ];

  let svg = '';

  // Gradients for area fills
  svg += '<defs>';
  svg += '<linearGradient id="lg-avoidable" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + avoidableColor + '" stop-opacity="0.2"/><stop offset="100%" stop-color="' + avoidableColor + '" stop-opacity="0"/></linearGradient>';
  svg += '<linearGradient id="lg-fertile" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + fertileColor + '" stop-opacity="0.22"/><stop offset="100%" stop-color="' + fertileColor + '" stop-opacity="0"/></linearGradient>';
  svg += '<linearGradient id="lg-observed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + observedColor + '" stop-opacity="0.18"/><stop offset="100%" stop-color="' + observedColor + '" stop-opacity="0"/></linearGradient>';
  svg += '<linearGradient id="lg-chart-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(139,155,184,0.04)"/><stop offset="100%" stop-color="rgba(255,255,255,0.01)"/></linearGradient>';
  svg += '</defs>';

  // Chart area background — SlipUp gradient
  svg += '<rect x="' + pad.left + '" y="' + pad.top + '" width="' + chartW + '" height="' + chartH + '" fill="url(#lg-chart-bg)" rx="6"/>';
  svg += '<rect x="' + pad.left + '" y="' + pad.top + '" width="' + chartW + '" height="' + chartH + '" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.5" rx="6"/>';

  // Softer horizontal grid (3 lines)
  for (let i = 1; i <= 3; i++) {
    const y = pad.top + (chartH * i) / 4;
    const val = Math.round(maxVal * (1 - i / 4));
    svg += '<line x1="' + pad.left + '" y1="' + y + '" x2="' + (pad.left + chartW) + '" y2="' + y + '" stroke="' + gridColor + '" stroke-width="0.5" stroke-dasharray="3 4"/>';
    if (val > 0) {
      svg += '<text x="' + (pad.left - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="9" fill="' + labelColor + '" font-family="DM Sans, sans-serif">' + val + '</text>';
    }
  }

  // Vertical grid + day labels
  const labelIndices = [0, 4, 8, 12, 13];
  labelIndices.forEach((i) => {
    if (i >= days.length) return;
    const x = scaleX(i);
    if (i > 0 && i < days.length - 1) {
      svg += '<line x1="' + x + '" y1="' + pad.top + '" x2="' + x + '" y2="' + (pad.top + chartH) + '" stroke="' + gridColor + '" stroke-width="0.5" stroke-dasharray="3 4"/>';
    }
    const label = i === 0 ? '14d ago' : i === days.length - 1 ? 'Today' : (14 - i) + 'd';
    svg += '<text x="' + x + '" y="' + (h - 6) + '" text-anchor="middle" font-size="9" fill="' + labelColor + '" font-family="DM Sans, sans-serif">' + label + '</text>';
  });

  // Area fills + lines + dots (fertile drawn last so it’s on top — SlipUp emphasis)
  const drawOrder = ['observed', 'avoidable', 'fertile'];
  drawOrder.forEach((key) => {
    const s = series.find(x => x.key === key);
    if (!s) return;
    const pts = days.map((d, i) => ({ x: scaleX(i), y: scaleY(d[s.key]) }));
    const areaPath = pts.map((p, i) => (i === 0 ? 'M' + p.x + ',' + p.y : 'L' + p.x + ',' + p.y)).join(' ') +
      ' L' + pts[pts.length - 1].x + ',' + (pad.top + chartH) + ' L' + pts[0].x + ',' + (pad.top + chartH) + ' Z';
    svg += '<path d="' + areaPath + '" fill="url(#lg-' + key + ')" />';
  });
  series.forEach((s) => {
    const pts = days.map((d, i) => scaleX(i) + ',' + scaleY(d[s.key]));
    svg += '<polyline fill="none" stroke="' + s.color + '" stroke-width="' + strokeW + '" stroke-linecap="round" stroke-linejoin="round" points="' + pts.join(' ') + '"></polyline>';
    days.forEach((d, i) => {
      const v = d[s.key];
      if (v === 0) return;
      const cx = scaleX(i);
      const cy = scaleY(v);
      svg += '<g class="chart-point" style="cursor:pointer"><circle cx="' + cx + '" cy="' + cy + '" r="' + dotR + '" fill="' + s.color + '" stroke="var(--surface)" stroke-width="2" opacity="0.95"/><text class="chart-point-value" x="' + cx + '" y="' + (cy - 12) + '" text-anchor="middle" font-size="10" font-weight="600" fill="' + s.color + '" font-family="DM Sans, sans-serif">' + v + '</text></g>';
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
  const trimmed = (value || '').trim();
  try {
    const key = getTodayKey();
    const raw = localStorage.getItem(MICRO_GOAL_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[key] = trimmed;
    localStorage.setItem(MICRO_GOAL_KEY, JSON.stringify(data));
  } catch (_) {}
  if (trimmed && SHARING_ENABLED && trimmed !== lastPushedIntention && (typeof navigator === 'undefined' || navigator.onLine)) {
    lastPushedIntention = trimmed;
    if (typeof logStateEvent === 'function') logStateEvent('action', 'micro_goal_share');
    pushIntentionToShared(trimmed);
  } else if (!trimmed) {
    lastPushedIntention = '';
  }
}

function pushIntentionToShared(intention) {
  if (!SHARING_ENABLED || !intention || intention.length > 13) return;
  if (MODE === 'inside') {
    const groupId = getInsideGroupId();
    if (!groupId) return;
  }
  try {
    const payload = {
      anonymous_id: MODE === 'personal' ? getOrCreateAnonId() : null,
      intention: intention.slice(0, 13),
      mode: MODE
    };
    if (MODE === 'inside') payload.group_id = getInsideGroupId();
    getSupabase()
      .from(INTENTIONS_TABLE)
      .insert(payload)
      .then(({ error }) => {
        if (error) console.warn('SlipUp: shared_intentions insert failed', error);
        else if (typeof fetchSharedIntentions === 'function') fetchSharedIntentions();
      })
      .catch((err) => console.warn('SlipUp: pushIntentionToShared failed', err));
  } catch (e) {
    console.warn('SlipUp: pushIntentionToShared failed', e);
  }
}

function fetchSharedIntentions(opts) {
  if (!SHARING_ENABLED || !sharedIntentionsChart) return;
  if (MODE === 'inside' && !getInsideGroupId()) return;
  const includeOlder = opts && opts.includeOlder;
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    let q = getSupabase()
      .from(INTENTIONS_TABLE)
      .select('intention, mode, created_at')
      .eq('mode', MODE)
      .order('created_at', { ascending: false });
    if (MODE === 'inside') q = q.eq('group_id', getInsideGroupId());
    if (MODE === 'inside' && !includeOlder) {
      q = q.gte('created_at', twoDaysAgo);
    }
    q = q.limit(includeOlder ? 50 : 20);
    q.then(({ data, error }) => {
      if (error) {
        if (sharedIntentionsBlock) sharedIntentionsBlock.classList.add('hidden');
        return;
      }
      renderSharedIntentions(data || [], includeOlder);
    }).catch(() => {
      if (sharedIntentionsBlock) sharedIntentionsBlock.classList.add('hidden');
    });
  } catch (_) {
    if (sharedIntentionsBlock) sharedIntentionsBlock.classList.add('hidden');
  }
}

function renderSharedIntentions(list, includeOlder) {
  if (!sharedIntentionsChart || !sharedIntentionsBlock) return;
  const empty = !list || list.length === 0;
  if (empty && !(MODE === 'inside' && !includeOlder)) {
    lastSharedIntentionsItems = [];
    sharedIntentionsBlock.classList.add('hidden');
    if (sharedIntentionsTableWrap) sharedIntentionsTableWrap.classList.add('hidden');
    if (btnViewOlderIntentions) btnViewOlderIntentions.classList.add('hidden');
    return;
  }
  sharedIntentionsBlock.classList.remove('hidden');
  if (empty && MODE === 'inside') {
    lastSharedIntentionsItems = [];
    sharedIntentionsChart.innerHTML = '';
    if (sharedIntentionsLabel) sharedIntentionsLabel.textContent = 'No recent intentions (last 2 days)';
    if (btnViewOlderIntentions) {
      btnViewOlderIntentions.classList.remove('hidden');
      btnViewOlderIntentions.textContent = 'View older';
    }
    return;
  }
  /* Group by intention (lowercase), count frequency, sort by count desc */
  const counts = {};
  list.forEach(function (row) {
    const txt = (row.intention || '').trim();
    if (!txt) return;
    const key = txt.toLowerCase();
    if (!counts[key]) counts[key] = { text: txt, count: 0 };
    counts[key].count += 1;
  });
  const items = Object.values(counts).sort(function (a, b) { return b.count - a.count; });
  lastSharedIntentionsItems = items;
  const totalShares = items.reduce(function (sum, x) { return sum + x.count; }, 0);
  const maxCount = items.length ? Math.max.apply(null, items.map(function (x) { return x.count; })) : 1;

  /* Single place: set label with count when we have data */
  if (sharedIntentionsLabel) {
    const countSuffix = totalShares > 0 ? ' — ' + totalShares + (totalShares === 1 ? ' shared' : ' shared') : '';
    if (MODE === 'inside') {
      const base = includeOlder ? "Your group's focus (all)" : "Your group's focus (last 2 days)";
      sharedIntentionsLabel.textContent = base + countSuffix;
    } else {
      sharedIntentionsLabel.textContent = 'What others are focusing on' + countSuffix;
    }
  }
  const html = items.map(function (item, i) {
    const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
    const countLabel = item.count === 1 ? '1 shared' : item.count + ' shared';
    return '<div class="shared-intention-bar-row" data-rank="' + (i + 1) + '" title="' + escapeHtml(item.text) + ' — ' + countLabel + '"><span class="shared-intention-bar-label">' + escapeHtml(item.text) + '</span><div class="shared-intention-bar-track"><span class="shared-intention-bar-fill" style="width:' + pct + '%"></span></div><span class="shared-intention-bar-count" aria-label="' + countLabel + '">' + countLabel + '</span></div>';
  }).join('');
  sharedIntentionsChart.innerHTML = html || '';

  /* Table removed — bar chart is the single clear visualization */
  if (sharedIntentionsTableWrap) sharedIntentionsTableWrap.classList.add('hidden');

  if (btnViewOlderIntentions) {
    if (MODE === 'inside') {
      btnViewOlderIntentions.classList.remove('hidden');
      btnViewOlderIntentions.textContent = includeOlder ? 'Show recent (2 days)' : 'View older';
    } else {
      btnViewOlderIntentions.classList.add('hidden');
    }
  }
}

function renderMicroGoal() {
  if (!microGoalInput || !microGoalResult) return;
  const goal = (microGoalInput.value || '').trim();
  const todayStart = getStartOfDay(Date.now());
  const todayEnd = todayStart + 86400000;
  const todayEntries = entries.filter(e => e.at >= todayStart && e.at < todayEnd);
  const avoidable = todayEntries.filter(e => (e.type || 'avoidable') === 'avoidable').length;
  const fertile = todayEntries.filter(e => (e.type || 'avoidable') === 'fertile').length;
  const observed = todayEntries.filter(e => (e.type || 'avoidable') === 'observed').length;
  const total = avoidable + fertile + observed;
  /* Update section left border by dominant type */
  const microGoalSection = document.getElementById('micro-goal-section');
  if (microGoalSection) {
    let domType = 'observed';
    if (total > 0) {
      if (fertile >= avoidable && fertile >= observed) domType = 'fertile';
      else if (avoidable >= fertile && avoidable >= observed) domType = 'avoidable';
    }
    microGoalSection.classList.remove('micro-goal-section--avoidable', 'micro-goal-section--fertile', 'micro-goal-section--observed');
    microGoalSection.classList.add('micro-goal-section--' + domType);
  }
  if (!goal) {
    microGoalResult.innerHTML = '';
    microGoalResult.classList.remove('micro-goal-result--has-chart');
    return;
  }
  const aLabel = MODE === 'inside' ? 'heat' : 'avoidable';
  const fLabel = MODE === 'inside' ? 'shift' : 'fertile';
  const oLabel = MODE === 'inside' ? 'support' : 'observed';

  let statusText = '';
  const lower = goal.toLowerCase();
  const underMatch = lower.match(/(?:under|less than|below)\s*(\d+)/) || lower.match(/(\d+)\s*(?:or\s*)?(?:fewer|less)/);
  if (underMatch) {
    const cap = parseInt(underMatch[1], 10);
    if (avoidable <= cap) {
      statusText = 'You aimed to keep ' + aLabel + ' under ' + cap + ' — on track';
    } else {
      statusText = 'Over by ' + (avoidable - cap) + ' — you aimed for under ' + cap;
    }
  } else if (/\b(?:one|1)\s*fertile/.test(lower) || /\b(?:one|1)\s*shift/.test(lower) || /fertile\s*(?:experiment|risk)/.test(lower) || /shift\s*(?:experiment)?/.test(lower)) {
    if (fertile >= 1) {
      statusText = 'You aimed for at least one ' + fLabel + ' — done';
    } else {
      statusText = 'You aimed for a ' + fLabel + ' — not yet';
    }
  } else {
    statusText = goal;
  }

  if (total === 0) {
    microGoalResult.innerHTML = '<p class="micro-goal-result-status micro-goal-result-status--goal">' + escapeHtml(statusText) + '</p>';
    microGoalResult.classList.add('micro-goal-result--has-chart');
    return;
  }

  const a = total > 0 ? avoidable / total : 0;
  const f = total > 0 ? fertile / total : 0;
  const o = total > 0 ? observed / total : 0;
  const seg = (type, ratio, count) => {
    if (count === 0) return '';
    const pct = Math.round(ratio * 100);
    const label = type === 'avoidable' ? aLabel : type === 'fertile' ? fLabel : oLabel;
    const minW = pct > 0 ? (pct < 12 ? '1.5em' : '4px') : '0';
    return '<span class="micro-goal-chart-seg micro-goal-chart-seg--' + type + '" style="flex:' + ratio + ' 1 0%;min-width:' + minW + '" title="' + count + ' ' + label + '">' + count + '</span>';
  };

  const barHtml = '<p class="micro-goal-chart-label">Today</p>' +
    '<div class="micro-goal-chart-bar" role="img" aria-label="Today: ' + avoidable + ' ' + aLabel + ', ' + fertile + ' ' + fLabel + ', ' + observed + ' ' + oLabel + '">' +
    seg('avoidable', a, avoidable) +
    seg('fertile', f, fertile) +
    seg('observed', o, observed) +
  '</div>';
  const statusHtml = '<p class="micro-goal-result-status">' + escapeHtml(statusText) + '</p>';

  microGoalResult.innerHTML = barHtml + statusHtml;
  microGoalResult.classList.add('micro-goal-result--has-chart');
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
          const label = type === 'avoidable' ? aLabel : type === 'fertile' ? fLabel : oLabel;
          const minW = pct > 0 ? (pct < 15 ? '1.6em' : '4px') : '0';
          return '<span class="insight-weekly-seg insight-weekly-seg--' + type + '" style="flex:' + ratio + ' 1 0%;min-width:' + minW + '" title="' + count + ' ' + label + '">' + count + '</span>';
        };
        weeklyDigestChart.innerHTML =
          '<div class="insight-weekly-bar" role="img" aria-label="This week: ' + thisWeek.avoidable + ' ' + aLabel + ', ' + thisWeek.fertile + ' ' + fLabel + ', ' + thisWeek.observed + ' ' + oLabel + '">' +
            seg('avoidable', a, thisWeek.avoidable) +
            seg('fertile', f, thisWeek.fertile) +
            seg('observed', o, thisWeek.observed) +
          '</div>' +
          '<div class="insight-weekly-meta">' +
            '<span class="insight-weekly-total">' + total + ' total</span>' +
            (thisWeek.avoidable || thisWeek.fertile ? '<span class="insight-weekly-expl" title="' + (MODE === 'inside' ? 'Share of shift vs heat — shift ÷ (heat + shift). Higher = more stretches, less tension.' : 'Share of fertile (experiments) vs avoidable (repeats). fertile ÷ total. Higher = more risks that grow you.') + '">' + expl + '% ' + explLabel + '<span class="insight-weekly-expl-tip" aria-label="What is ' + explLabel + '?">?</span></span>' : '') +
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

  if (monthlyDigestChart || monthlyDigest) {
    const thisMonth = getThisMonthStats();
    const total = thisMonth.avoidable + thisMonth.fertile + thisMonth.observed;
    if (total === 0) {
      if (monthlyDigestChart) {
        monthlyDigestChart.innerHTML = '';
        monthlyDigestChart.classList.add('hidden');
      }
      if (monthlyDigest) monthlyDigest.textContent = 'Log entries over the month to see your monthly chart here.';
    } else {
      const explLabel = MODE === 'inside' ? 'shift' : 'exploration';
      const expl = thisMonth.exploration != null ? thisMonth.exploration : 0;
      if (monthlyDigestChart) {
        monthlyDigestChart.classList.remove('hidden');
        const a = total > 0 ? thisMonth.avoidable / total : 0;
        const f = total > 0 ? thisMonth.fertile / total : 0;
        const o = total > 0 ? thisMonth.observed / total : 0;
        const seg = (type, ratio, count) => {
          if (count === 0) return '';
          const pct = Math.round(ratio * 100);
          const label = type === 'avoidable' ? aLabel : type === 'fertile' ? fLabel : oLabel;
          const minW = pct > 0 ? (pct < 15 ? '1.6em' : '4px') : '0';
          return '<span class="insight-weekly-seg insight-weekly-seg--' + type + '" style="flex:' + ratio + ' 1 0%;min-width:' + minW + '" title="' + count + ' ' + label + '">' + count + '</span>';
        };
        monthlyDigestChart.innerHTML =
          '<div class="insight-weekly-bar" role="img" aria-label="This month: ' + thisMonth.avoidable + ' ' + aLabel + ', ' + thisMonth.fertile + ' ' + fLabel + ', ' + thisMonth.observed + ' ' + oLabel + '">' +
            seg('avoidable', a, thisMonth.avoidable) +
            seg('fertile', f, thisMonth.fertile) +
            seg('observed', o, thisMonth.observed) +
          '</div>' +
          '<div class="insight-weekly-meta">' +
            '<span class="insight-weekly-total">' + total + ' total</span>' +
            (thisMonth.avoidable || thisMonth.fertile ? '<span class="insight-weekly-expl" title="' + (MODE === 'inside' ? 'Share of shift vs heat — shift ÷ (heat + shift). Higher = more stretches, less tension.' : 'Share of fertile (experiments) vs avoidable (repeats). fertile ÷ total. Higher = more risks that grow you.') + '">' + expl + '% ' + explLabel + '<span class="insight-weekly-expl-tip" aria-label="What is ' + explLabel + '?">?</span></span>' : '') +
          '</div>';
      }
      if (monthlyDigest) {
        if (thisMonth.exploration != null && (thisMonth.avoidable || thisMonth.fertile)) {
          monthlyDigest.textContent = thisMonth.exploration >= 40 ? 'Good mix over the month.' : 'Room to add more experiments this month.';
        } else {
          monthlyDigest.textContent = 'Keep logging to see your monthly exploration trend.';
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
    const dayObserved = filterByPeriod('day').filter(e => (e.type || 'avoidable') === 'observed');
    const weekObserved = filterByPeriod('week').filter(e => (e.type || 'avoidable') === 'observed');
    const monthObserved = filterByPeriod('month').filter(e => (e.type || 'avoidable') === 'observed');
    const observed = filterByPeriod(currentPeriod).filter(e => (e.type || 'avoidable') === 'observed');
    const oLabel = MODE === 'inside' ? 'support' : 'observed';

    if (biasCheckPeriodBreakdown) {
      const sep = '<span class="bias-check-period-sep"> · </span>';
      const seg = function (n) {
        return '<span class="bias-check-period-num">' + n + '</span>';
      };
      const dayLab = 'today';
      const weekLab = 'this week';
      const monthLab = 'this month';
      let html = seg(dayObserved.length) + ' ' + dayLab + sep + seg(weekObserved.length) + ' ' + weekLab + sep + seg(monthObserved.length) + ' ' + monthLab;
      const g = lastGlobalObservedCount;
      if (typeof g === 'number') {
        html += '<span class="bias-check-period-sep"> — </span><span class="bias-check-period-global">' + g + ' from everyone</span>';
      }
      biasCheckPeriodBreakdown.innerHTML = html;
    }

    if (observed.length > 0) {
      const observedSorted = observed.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
      const pills = observedSorted.slice(0, 3).map(function (e) {
        const note = (e.note || '').trim() || "I couldn't tell";
        const short = note.length > 20 ? note.slice(0, 17) + '…' : note;
        const biasLabel = (e.biasReason && BIAS_DISPLAY[e.biasReason]) ? '<span class="bias-check-choice bias-check-choice--' + e.biasReason + '" title="' + escapeHtml(BIAS_TITLES[e.biasReason] || '') + '">' + escapeHtml(BIAS_DISPLAY[e.biasReason]) + '</span>' : '';
        return '<span class="bias-check-note-pill" title="' + escapeHtml(note) + (e.biasReason ? ' · ' + (BIAS_TITLES[e.biasReason] || '') : '') + '">' +
          '<span class="bias-check-note-text">' + escapeHtml(short) + '</span>' +
          (biasLabel ? '<span class="bias-check-sep" aria-hidden="true"> · </span>' + biasLabel : '') +
        '</span>';
      }).join(' ');
      biasCheckInsight.innerHTML =
        '<div class="bias-check-insight-row">' +
          '<div class="bias-check-data">' +
            (pills ? '<span class="bias-check-data-pills" aria-label="Recent observed entries with bias reason">' + pills + '</span>' : '') +
          '</div>' +
        '</div>';
    } else {
      biasCheckInsight.innerHTML =
        '<div class="bias-check-insight-row">' +
          '<div class="bias-check-data bias-check-empty">No ' + oLabel + ' yet. Spot a pattern in others? Log one when you notice.</div>' +
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
  const statAvgEl = document.getElementById('stat-avg');
  const statExplorationEl = document.getElementById('stat-exploration');
  const statsInsightEl = document.getElementById('stats-insight');
  const streakNoteEl = document.getElementById('streak-note');
  const statExplorationSoWhatEl = document.getElementById('stat-exploration-so-what');
  if (!statCountEl) return;

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
  const countStr = statCountEl.textContent + ' ' + (getPeriodLabel(currentPeriod) || 'slip-ups');
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

  // Unified insight line
  if (statsInsightEl && statsInsightEl.textContent) {
    ctx.fillStyle = muted;
    ctx.fillText(statsInsightEl.textContent, cardX + pad, y);
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
  updateMistakeNoteCharCount();
  updateUpgradeUI();
  if (addNoteInput) addNoteInput.focus();
  logStateEvent('action', 'add_entry');
  logStateEvent('entry_type', type);
  renderStats();
  renderList();
  if (SHARING_ENABLED && MODE !== 'inside') {
    pushEntryToShared({ note, type, theme: entry.theme });
    setTimeout(function () { if (typeof fetchSharedEntries === 'function') fetchSharedEntries(); }, 1200);
  } else if (!SHARING_ENABLED && MODE === 'personal' && addSyncStatus) {
    showAddSyncStatus('Saved locally — add config.js to sync to world feed', false);
  }
  if (MODE === 'inside' && shareToGroupSection) {
    renderShareToGroupList();
    setTimeout(function () { if (typeof fetchSharedCountsForInsideButton === 'function') fetchSharedCountsForInsideButton(); }, 1200);
  }
}

function getUnsharedEntries() {
  return entries.filter(e => !e.sharedAt).sort((a, b) => b.at - a.at);
}

function renderShareToGroupList() {
  if (!shareToGroupSection || !shareToGroupList || MODE !== 'inside') return;
  const unshared = getUnsharedEntries();
  const emptyEl = document.getElementById('share-to-group-empty');
  if (emptyEl) emptyEl.classList.toggle('hidden', unshared.length > 0);
  shareToGroupSection.classList.toggle('hidden', !SHARING_ENABLED);
  if (!SHARING_ENABLED) return;
  shareToGroupList.innerHTML = '';
  const labels = { avoidable: 'Heat', fertile: 'Shift', observed: 'Support' };
  unshared.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'share-to-group-item';
    li.dataset.at = String(entry.at);
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'share-to-group-cb';
    cb.dataset.at = String(entry.at);
    cb.setAttribute('aria-label', 'Select to share');
    const wrap = document.createElement('label');
    wrap.className = 'share-to-group-item-wrap';
    const type = entry.type || 'avoidable';
    const typeLabel = labels[type] || type;
    const note = (entry.note || "I couldn't tell").slice(0, 19);
    wrap.innerHTML = '<span class="share-to-group-type share-to-group-type--' + type + '">' + escapeHtml(typeLabel) + '</span> <span class="share-to-group-note">' + escapeHtml(note) + '</span>';
    wrap.prepend(cb);
    li.appendChild(wrap);
    shareToGroupList.appendChild(li);
  });
  updateShareToGroupButton();
}

function getSelectedShareEntries() {
  if (!shareToGroupList) return [];
  const checked = shareToGroupList.querySelectorAll('.share-to-group-cb:checked');
  const ats = Array.from(checked).map(cb => parseInt(cb.dataset.at, 10));
  return entries.filter(e => ats.includes(e.at));
}

function updateShareToGroupButton() {
  if (!btnShareToGroup || !btnShareToGroupSelectAll) return;
  const selected = getSelectedShareEntries();
  const unshared = getUnsharedEntries();
  const n = selected.length;
  btnShareToGroup.disabled = n === 0;
  btnShareToGroup.textContent = n === 0 ? 'Share 0 to group' : 'Share ' + n + ' to group';
  btnShareToGroupSelectAll.textContent = n === unshared.length && unshared.length > 0 ? 'Deselect all' : 'Select all';
}

async function shareSelectedToGroup() {
  const selected = getSelectedShareEntries();
  if (selected.length === 0 || !SHARING_ENABLED) return;
  const groupId = MODE === 'inside' ? getInsideGroupId() : null;
  if (MODE === 'inside' && !groupId) {
    if (shareToGroupStatus) shareToGroupStatus.textContent = 'Sign in and join a group to share.';
    return;
  }
  if (shareToGroupStatus) shareToGroupStatus.textContent = 'Sharing…';
  if (btnShareToGroup) btnShareToGroup.disabled = true;
  const client = getSupabase();
  const now = new Date();
  const useSplitTable = ENTRIES_TABLE === 'shared_entries_inside';
  let userId = null;
  try {
    const { data: { user } } = await client.auth.getUser();
    if (user) userId = user.id;
  } catch (_) {}
  let ok = 0;
  for (const entry of selected) {
    try {
      const payload = {
        note: entry.note || null,
        type: entry.type || 'avoidable',
        theme: entry.theme || getCurrentTheme(),
        hour_utc: now.getUTCHours()
      };
      if (useSplitTable) {
        payload.group_id = groupId;
        if (userId) payload.user_id = userId;
      } else {
        payload.mode = 'inside';
        if (groupId) payload.group_id = groupId;
        if (userId) payload.user_id = userId;
      }
      const { error } = await client.from(ENTRIES_TABLE).insert(payload);
      if (error) throw error;
      entry.sharedAt = Date.now();
      ok += 1;
    } catch (e) {
      console.warn('SlipUp: share to group failed', e);
    }
  }
  saveEntries();
  renderShareToGroupList();
  renderList();
  if (shareToGroupStatus) shareToGroupStatus.textContent = ok === selected.length ? 'Shared ' + ok + ' to group.' : 'Shared ' + ok + ' of ' + selected.length + '.';
  if (btnShareToGroup) btnShareToGroup.disabled = false;
  if (typeof fetchSharedCountsForInsideButton === 'function') fetchSharedCountsForInsideButton();
  if (typeof refreshGroupEngagement === 'function') refreshGroupEngagement();
  if (shareToGroupStatus) setTimeout(() => { shareToGroupStatus.textContent = ''; }, 3000);
}

function showAddSyncStatus(text, isError) {
  if (!addSyncStatus) return;
  addSyncStatus.textContent = text;
  addSyncStatus.classList.remove('add-sync-status--error');
  if (isError) addSyncStatus.classList.add('add-sync-status--error');
  addSyncStatus.classList.remove('hidden');
  clearTimeout(showAddSyncStatus._timer);
  showAddSyncStatus._timer = setTimeout(function () {
    if (addSyncStatus) addSyncStatus.classList.add('hidden');
  }, 4000);
}

function pushEntryToShared(entry) {
  if (!SHARING_ENABLED) return;
  showAddSyncStatus('Syncing to world feed…', false);
  try {
    const now = new Date();
    const payload = {
      note: entry.note || null,
      type: entry.type || 'avoidable',
      theme: entry.theme || getCurrentTheme(),
      hour_utc: now.getUTCHours()
    };
    if (ENTRIES_TABLE !== 'shared_entries_personal') payload.mode = MODE;
    getSupabase()
      .from(ENTRIES_TABLE)
      .insert(payload)
      .then(({ error }) => {
        if (error) {
          const msg = error.message || error.error_description || (error.msg && error.msg.message) || JSON.stringify(error);
          showAddSyncStatus('Couldn\'t sync: ' + (msg.length > 50 ? msg.slice(0, 50) + '…' : msg), true);
          if (sharedEntriesError) {
            sharedEntriesError.textContent = 'Could not add to feed: ' + msg + ' (see console)';
            sharedEntriesError.classList.remove('hidden');
          }
          if (topBarSlipups) {
            topBarSlipups.classList.add('top-bar-slipups--push-failed');
            topBarSlipups.setAttribute('title', 'Could not sync to world feed — tap to refresh');
            setTimeout(function () {
              if (topBarSlipups) {
                topBarSlipups.classList.remove('top-bar-slipups--push-failed');
              }
            }, 6000);
          }
          console.warn('SlipUp: shared_what_happened insert failed', { table: ENTRIES_TABLE, error });
          return;
        }
        showAddSyncStatus('Added to world ✓', false);
        if (topBarSlipups) topBarSlipups.classList.remove('top-bar-slipups--push-failed');
        if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
        [300, 800, 1500].forEach(function (ms) {
          setTimeout(function () { if (typeof fetchSharedEntries === 'function') fetchSharedEntries(); }, ms);
        });
      })
      .catch((err) => {
        const msg = (err && (err.message || err.toString())) || 'Network error';
        showAddSyncStatus('Couldn\'t sync: ' + (msg.length > 50 ? msg.slice(0, 50) + '…' : msg), true);
        if (sharedEntriesError) {
          sharedEntriesError.textContent = 'Could not add this entry to the feed: ' + (msg || 'Network or request error');
          sharedEntriesError.classList.remove('hidden');
        }
        if (topBarSlipups) {
          topBarSlipups.classList.add('top-bar-slipups--push-failed');
          topBarSlipups.setAttribute('title', 'Could not sync to world feed — tap to refresh');
          setTimeout(function () {
            if (topBarSlipups) topBarSlipups.classList.remove('top-bar-slipups--push-failed');
          }, 6000);
        }
        console.warn('SlipUp: shared_what_happened insert error', err);
      });
  } catch (e) {
    showAddSyncStatus('Couldn\'t sync — check config', true);
    if (sharedEntriesError) {
      sharedEntriesError.textContent = 'Could not share entry: ' + (e && e.message ? e.message : 'Check config (Supabase URL and anon key).');
      sharedEntriesError.classList.remove('hidden');
    }
    if (topBarSlipups) {
      topBarSlipups.classList.add('top-bar-slipups--push-failed');
      topBarSlipups.setAttribute('title', 'Could not sync — check config');
    }
    console.warn('SlipUp: pushEntryToShared failed', e);
  }
}

function setPeriod(period) {
  currentPeriod = period;
  logStateEvent('period', period);
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
        const o = opts || {};
        const headers = new Headers(o.headers || {});
        headers.set('Cache-Control', 'no-cache, no-store');
        headers.set('Pragma', 'no-cache');
        return fetch(url, { ...o, cache: 'no-store', headers });
      }
    }
  });
}

function getOrCreateSessionId() {
  if (stateEventSessionId) return stateEventSessionId;
  stateEventSessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return stateEventSessionId;
}

function getCurrentViewSource() {
  if (personalView && socialView) {
    return personalView.classList.contains('hidden') ? 'social_view' : 'personal_view';
  }
  return 'personal_view';
}

/** Log a state event (phase, filter_type, filter_theme, view, action) with anonymous_id.
 *  Optional third arg: { source: string, extra: object }. Sends session_id and source when table has those columns. */
function logStateEvent(kind, value, options) {
  if (!SHARING_ENABLED || !STATE_EVENTS_TABLE || !kind || value == null) return;
  try {
    const payload = {
      anonymous_id: getOrCreateAnonId(),
      kind: String(kind),
      value: String(value),
      mode: MODE,
      session_id: getOrCreateSessionId(),
      source: (options && options.source != null) ? String(options.source) : getCurrentViewSource()
    };
    if (options && options.extra != null && typeof options.extra === 'object') {
      payload.extra = options.extra;
    }
    getSupabase().from(STATE_EVENTS_TABLE).insert(payload).then(({ error }) => {
      if (error) console.warn('SlipUp: state_events insert failed', { kind, value, error });
    });
  } catch (e) {
    console.warn('SlipUp: state_events insert failed', e);
  }
}

function getCurrentStatsForShare() {
  const filtered = filterByPeriod(currentPeriod);
  const count = filtered.length;
  const days = getDaysInPeriod(currentPeriod);
  const avg = days > 0 ? parseFloat((count / days).toFixed(1)) : null;
  return { period: currentPeriod, count, avg_per_day: avg };
}

function updateSocialToShare() {
  if (!socialToShare) return;
  const stats = getCurrentStatsForShare();
  const noun = MODE === 'inside' ? 'moments' : 'slip-ups';
  const count = stats.count;
  if (socialToShareCount) {
    socialToShareCount.textContent = count;
    socialToShareCount.classList.toggle('social-to-share-empty', count === 0);
  }
  if (socialToShareLabel) {
    if (count === 0) {
      socialToShareLabel.textContent = 'Add one above to contribute';
    } else {
      const nounSingular = noun === 'moments' ? 'moment' : 'slip-up';
      socialToShareLabel.textContent = (count === 1 ? nounSingular : noun) + ' ready — share to add yours to the world chart';
    }
  }
  socialToShare.classList.toggle('social-to-share-empty', count === 0);
}

function saveStreakReflectionToSupabase(choice) {
  if (!SHARING_ENABLED || !choice) return;
  logStateEvent('streak_choice', choice);
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
  logStateEvent('action', 'share');
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
    const payload = {
      period: stats.period,
      count: stats.count,
      avg_per_day: stats.avg_per_day,
      anonymous_id: getOrCreateAnonId()
    };
    if (avoidableCount > 0 || fertileCount > 0 || observedCount > 0) {
      payload.avoidable_count = avoidableCount;
      payload.fertile_count = fertileCount;
      payload.observed_count = observedCount;
    }
    let insertResult = await client.from(STATS_TABLE).insert(payload);
    if (insertResult.error && /column.*does not exist/i.test(insertResult.error.message || '')) {
      delete payload.avoidable_count;
      delete payload.fertile_count;
      delete payload.observed_count;
      insertResult = await client.from(STATS_TABLE).insert(payload);
    }
    const { error } = insertResult;
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
  logStateEvent('action', 'add_entry');
  logStateEvent('entry_type', type);
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
  if (SHARING_ENABLED && MODE !== 'inside') {
    pushEntryToShared({ note: '', type, theme: entry.theme });
    setTimeout(function () { if (typeof fetchSharedEntries === 'function') fetchSharedEntries(); }, 1200);
  } else if (!SHARING_ENABLED && MODE === 'personal' && addSyncStatus) {
    showAddSyncStatus('Saved locally — add config.js to sync to world feed', false);
  }
  if (MODE === 'inside' && shareToGroupSection) {
    renderShareToGroupList();
    setTimeout(function () { if (typeof fetchSharedCountsForInsideButton === 'function') fetchSharedCountsForInsideButton(); }, 1200);
  }
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
  if (SHARING_ENABLED && MODE !== 'inside') {
    pushEntryToShared({ note: entry.note, type: entry.type, theme: entry.theme });
    setTimeout(function () { if (typeof fetchSharedEntries === 'function') fetchSharedEntries(); }, 1200);
  } else if (!SHARING_ENABLED && MODE === 'personal' && addSyncStatus) {
    showAddSyncStatus('Saved locally — add config.js to sync to world feed', false);
  }
  if (MODE === 'inside' && shareToGroupSection) {
    renderShareToGroupList();
    setTimeout(function () { if (typeof fetchSharedCountsForInsideButton === 'function') fetchSharedCountsForInsideButton(); }, 1200);
  }
}

function exportCsv() {
  logStateEvent('action', 'export_csv');
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
  logStateEvent('action', 'export_json');
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

function exportIntentionsCsv() {
  if (!isUnlocked()) return;
  logStateEvent('action', 'export_intentions_csv');
  const items = lastSharedIntentionsItems || [];
  const rows = [['Intention', 'Shared']];
  items.forEach(item => {
    const text = (item.text || '').replace(/"/g, '""');
    rows.push([`"${text}"`, item.count]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = MODE === 'inside' ? 'slipup-inside-intentions.csv' : 'slipup-intentions.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportFeedCsv() {
  if (!isUnlocked()) return;
  logStateEvent('action', 'export_feed_csv');
  const source = Array.isArray(lastSharedEntries) ? lastSharedEntries : [];
  const rows = [['type', 'note', 'theme', 'created_at']];
  source.forEach(row => {
    const note = (row.note || '').replace(/"/g, '""');
    const type = row.type || 'avoidable';
    const theme = row.theme || 'calm';
    const created = row.created_at || '';
    rows.push([type, `"${note}"`, theme, created]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = MODE === 'inside' ? 'slipup-inside-feed.csv' : 'slipup-world-feed.csv';
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
  const selectExtended = 'id, period, count, avg_per_day, created_at, anonymous_id, avoidable_count, fertile_count, observed_count';
  const selectBase = 'id, period, count, avg_per_day, created_at, anonymous_id';
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  let statsQuery = client.from(STATS_TABLE).select(selectExtended).order('created_at', { ascending: false }).limit(MAX_OTHER_RESULTS);
  let metricsQuery = client.from(STATS_TABLE).select('id, anonymous_id, created_at').gte('created_at', sevenDaysAgo).limit(500);
  if (MODE === 'inside') {
    const gid = getInsideGroupId();
    if (gid) {
      statsQuery = statsQuery.eq('group_id', gid);
      metricsQuery = metricsQuery.eq('group_id', gid);
    }
  }
  let [result, metricsResult] = await Promise.all([statsQuery, metricsQuery]);
  if (result.error && /column.*does not exist/i.test(result.error.message || '')) {
    statsQuery = client.from(STATS_TABLE).select(selectBase).order('created_at', { ascending: false }).limit(MAX_OTHER_RESULTS);
    if (MODE === 'inside' && getInsideGroupId()) statsQuery = statsQuery.eq('group_id', getInsideGroupId());
    result = await statsQuery;
  }
  const { data, error } = result;
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
      ? "No shared results yet. Share your period below!"
      : "No shared results yet. Share yours below!";
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
    const toTs = (r) => { const t = new Date(r.created_at || 0).getTime(); return isNaN(t) ? 0 : t; };
    const aMax = byAnon[a].length ? Math.max(...byAnon[a].map(toTs)) : 0;
    const bMax = byAnon[b].length ? Math.max(...byAnon[b].map(toTs)) : 0;
    return bMax - aMax;
  });
  const allRows = groupKeys.flatMap(anonKey => (byAnon[anonKey] || []));
  const maxCount = allRows.length > 0 ? Math.max(...allRows.map(r => r.count)) : 1;
  const typeLabels = MODE === 'inside'
    ? { avoidable: 'heat', fertile: 'shift', observed: 'support' }
    : { avoidable: 'avoidable', fertile: 'fertile', observed: 'observed' };
  let chartHtml = '';
  groupKeys.forEach(anonKey => {
    const rows = byAnon[anonKey] || [];
    const shareCount = rows.length;
    chartHtml += '<div class="shared-group-chart"><div class="shared-group-label">' + (shareCount === 1 ? "Someone's share" : "Someone's shares (" + shareCount + ")") + '</div><div class="shared-share-cards">';
    rows.forEach(row => {
      const periodLabel = getPeriodLabel(row.period);
      const timeStr = row.created_at ? new Date(row.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
      const avgStr = row.avg_per_day != null ? String(row.avg_per_day) : '—';
      const av = row.avoidable_count ?? 0;
      const fv = row.fertile_count ?? 0;
      const ov = row.observed_count ?? 0;
      const primaryTotal = av + fv;
      const explorationPct = primaryTotal > 0 ? Math.round((fv / primaryTotal) * 100) : null;
      const dominantType = av >= fv && av >= ov ? 'avoidable' : fv >= ov ? 'fertile' : 'observed';
      let cardClass = 'shared-share-card shared-share-card--' + dominantType;
      chartHtml += '<div class="' + cardClass + '">';
      chartHtml += '<div class="shared-share-header"><span class="shared-share-period">' + escapeHtml(periodLabel) + '</span><span class="shared-share-time">' + escapeHtml(timeStr) + '</span></div>';
      chartHtml += '<div class="shared-share-metrics">';
      chartHtml += '<span class="shared-share-count">' + row.count + '</span>';
      chartHtml += '<span class="shared-share-avg">' + avgStr + '/day</span>';
      if (explorationPct != null) {
        chartHtml += '<span class="shared-share-exploration">' + explorationPct + '% exploration</span>';
      }
      chartHtml += '</div>';
      if (av > 0 || fv > 0 || ov > 0) {
        const parts = [];
        if (av > 0) parts.push('<span class="shared-share-type shared-share-type--avoidable">' + av + ' ' + typeLabels.avoidable + '</span>');
        if (fv > 0) parts.push('<span class="shared-share-type shared-share-type--fertile">' + fv + ' ' + typeLabels.fertile + '</span>');
        if (ov > 0) parts.push('<span class="shared-share-type shared-share-type--observed">' + ov + ' ' + typeLabels.observed + '</span>');
        chartHtml += '<div class="shared-share-breakdown">' + parts.join('<span class="shared-share-type-sep"> · </span>') + '</div>';
      }
      chartHtml += '</div>';
    });
    chartHtml += '</div></div>';
  });
  if (sharedListChart) sharedListChart.innerHTML = chartHtml;
  if (communityMetricsChart) {
    let metricRows = (metricsResult && !metricsResult.error && metricsResult.data) ? metricsResult.data : [];
    if (metricRows.length === 0 && limited.length > 0) {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 86400000;
      metricRows = limited.filter(row => row.created_at && new Date(row.created_at).getTime() >= sevenDaysAgo);
    }
    const uniquePeople = {};
    metricRows.forEach(row => {
      const key = row.anonymous_id || '__anon__';
      uniquePeople[key] = true;
    });
    const shareCount = metricRows.length;
    const peopleCount = Object.keys(uniquePeople).length;
    const maxBar = Math.max(shareCount, peopleCount, 1);
    const sharesW = Math.min(100, (shareCount / maxBar) * 100);
    const peopleW = Math.min(100, (peopleCount / maxBar) * 100);
    communityMetricsChart.innerHTML =
        '<div class="community-metrics-card">' +
        '<div class="community-metrics-row">' +
        '<div class="community-metric-pill community-metric-pill--shares"><span class="community-metric-val">' + shareCount + '</span><span class="community-metric-label">shares</span></div>' +
        '<div class="community-metric-pill community-metric-pill--people"><span class="community-metric-val">' + peopleCount + '</span><span class="community-metric-label">people</span></div>' +
        '</div>' +
        '<div class="community-metrics-bars">' +
        '<div class="community-metric-row"><span class="community-metric-bar-label">Shares</span><div class="community-metric-bar-wrap"><div class="community-metric-bar community-metric-bar--shares" style="width:' + sharesW + '%"></div></div></div>' +
        '<div class="community-metric-row"><span class="community-metric-bar-label">People</span><div class="community-metric-bar-wrap"><div class="community-metric-bar community-metric-bar--people" style="width:' + peopleW + '%"></div></div></div>' +
        '</div>' +
        '<p class="community-metrics-note">Last 7 days</p></div>';
  }
}

function showCommunitySetupMessage() {
  if (!sharedListChart || !sharedEmpty) return;
  sharedListChart.innerHTML = '';
  if (communityMetricsChart) communityMetricsChart.innerHTML = '';
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

    const usePersonalSplit = ENTRIES_TABLE === 'shared_entries_personal';
    const useInsideSplit = ENTRIES_TABLE === 'shared_entries_inside';
    let entriesQuery = client.from(ENTRIES_TABLE).select('id, note, type, theme, created_at').order('created_at', { ascending: false }).limit(sharedEntriesLimit);
    if (useInsideSplit) {
      const gid = getInsideGroupId();
      if (gid) entriesQuery = entriesQuery.eq('group_id', gid);
    } else if (!usePersonalSplit) {
      entriesQuery = entriesQuery.eq('mode', MODE);
      if (MODE === 'inside') {
        const gid = getInsideGroupId();
        if (gid) entriesQuery = entriesQuery.eq('group_id', gid);
      }
    }
    const { data, error } = await entriesQuery;
    if (error) throw error;

    let globalTotal = 0;
    let globalAvoidable = 0;
    let globalFertile = 0;
    let globalObserved = 0;
    try {
      let totalQ = client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true });
      let avoidQ = client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('type', 'avoidable');
      let fertQ = client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('type', 'fertile');
      let obsQ = client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('type', 'observed');
      if (useInsideSplit) {
        const gid = getInsideGroupId();
        if (gid) {
          totalQ = totalQ.eq('group_id', gid);
          avoidQ = avoidQ.eq('group_id', gid);
          fertQ = fertQ.eq('group_id', gid);
          obsQ = obsQ.eq('group_id', gid);
        }
      } else if (!usePersonalSplit) {
        totalQ = totalQ.eq('mode', MODE);
        avoidQ = avoidQ.eq('mode', MODE);
        fertQ = fertQ.eq('mode', MODE);
        obsQ = obsQ.eq('mode', MODE);
        if (MODE === 'inside') {
          const gid = getInsideGroupId();
          if (gid) {
            totalQ = totalQ.eq('group_id', gid);
            avoidQ = avoidQ.eq('group_id', gid);
            fertQ = fertQ.eq('group_id', gid);
            obsQ = obsQ.eq('group_id', gid);
          }
        }
      }
      const [totalRes, avoidRes, fertRes, obsRes] = await Promise.all([totalQ, avoidQ, fertQ, obsQ]);
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

    sharedEntriesEmpty.classList.toggle('hidden', list.length > 0);
    sharedEntriesEmpty.textContent = list.length === 0
      ? (MODE === 'inside' ? "No shared moments yet. Add one to contribute yours." : "No shared entries yet. Add a mistake above to contribute yours.")
      : "";
    if (sharedEntriesError) {
      sharedEntriesError.classList.add('hidden');
      sharedEntriesError.textContent = '';
    }
    const primaryTotal = avoidable + fertile;
    const sharedFertilePct = primaryTotal > 0 ? Math.round((fertile / primaryTotal) * 100) : null;
    const total = globalTotal > 0 ? globalTotal : (avoidable + fertile + observed);
    const primaryGlobal = globalAvoidable + globalFertile;
    const globalFertilePct = primaryGlobal > 0 ? Math.round((globalFertile / primaryGlobal) * 100) : null;

    function formatExplorationLabel(pct, prefix, isInside) {
      if (pct == null) return null;
      const noun = isInside ? 'shift' : 'experiments';
      if (pct === 0) return prefix + (isInside ? 'No shift yet' : 'No experiments yet');
      if (pct === 100) return prefix + (isInside ? 'All shift' : 'All experiments');
      return prefix + pct + '% ' + noun;
    }

    lastGlobalObservedCount = globalObserved;
    renderInsights();
    // Chart shows global totals (all shared entries by type); trend shows current list slice
    renderGlobalCountChart(globalAvoidable, globalFertile, globalObserved);
    const a = MODE === 'inside' ? 'heat' : 'avoidable';
    const f = MODE === 'inside' ? 'shift' : 'fertile';
    const o = MODE === 'inside' ? 'support' : 'observed';
    const noun = MODE === 'inside' ? 'moments' : 'slip-ups';
    let tooltip = total + ' ' + noun + ' · ' + globalAvoidable + ' ' + a + ', ' + globalFertile + ' ' + f + ', ' + globalObserved + ' ' + o;
    if (globalFertilePct != null) {
      tooltip += (MODE === 'inside' ? ' · ' + globalFertilePct + '% shift' : ' · ' + globalFertilePct + '% experiments');
    }
    if (btnSharedTotal) {
      btnSharedTotal.textContent = '🌍 ' + total + ' ' + noun;
      btnSharedTotal.setAttribute('aria-label', 'World ' + noun + ': ' + total);
      btnSharedTotal.title = tooltip;
    }
    if (topBarSlipups) {
      topBarSlipups.classList.remove('top-bar-slipups--push-failed');
      topBarSlipups.textContent = '\uD83C\uDF0D ' + total;
      topBarSlipups.setAttribute('aria-label', 'World: ' + total);
      topBarSlipups.title = total > 0 ? tooltip : "See everyone's entries — opens world feed";
    }
    if (typeof updateSharedEntriesLimitButtons === 'function') updateSharedEntriesLimitButtons();
    if (communityEntriesLastUpdated) {
      communityEntriesLastUpdated.textContent = 'Just refreshed';
      communityEntriesLastUpdated.classList.remove('hidden');
      clearTimeout(communityEntriesLastUpdated._timer);
      communityEntriesLastUpdated._timer = setTimeout(function () {
        if (communityEntriesLastUpdated) communityEntriesLastUpdated.textContent = '';
      }, 3000);
    }
    renderSharedEntriesList();
    if (MODE !== 'inside' && typeof renderGlobalPatternsChart === 'function') renderGlobalPatternsChart();
  } catch (err) {
    const raw = err && (err.message || err.error_description || err.msg) || '';
    const msg = typeof raw === 'string' ? raw : (raw && raw.message) || 'Unknown error';
    renderGlobalCountChart(0, 0, 0);
    const noun0 = MODE === 'inside' ? 'moments' : 'slip-ups';
    if (btnSharedTotal) btnSharedTotal.textContent = '🌍 0 ' + noun0;
    if (topBarSlipups) topBarSlipups.textContent = '\uD83C\uDF0D 0';
    if (sharedEntriesError) {
      sharedEntriesError.textContent = 'Could not load: ' + (/unregistered\s*api\s*key/i.test(msg) ? 'Unregistered API key' : msg);
      sharedEntriesError.classList.remove('hidden');
    }
    sharedEntriesList.innerHTML = '';
    if (sharedEntriesEmpty) {
      sharedEntriesEmpty.textContent = "Could not load everyone's entries. Check config and try again.";
      sharedEntriesEmpty.classList.remove('hidden');
    }
    if (MODE !== 'inside' && typeof renderGlobalPatternsChart === 'function') renderGlobalPatternsChart();
  }
}

function renderGlobalPatternsChart() {
  const chart = document.getElementById('global-patterns-chart');
  const block = document.getElementById('global-patterns-block');
  if (!chart || !block) return;
  const source = Array.isArray(lastSharedEntries) ? lastSharedEntries : [];
  const STOP_WORDS = new Set(['a', 'an', 'the', 'is', 'it', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'i', 'me', 'my', 'we', 'be', 'so', 'no', 'or', 'and', 'but', 'if', 'as', 'up', 'do', 'go', 'get', 'got']);
  const wordCounts = {};
  source.forEach(function (row) {
    const note = ((row && row.note) || '').trim().toLowerCase();
    if (note.length < 2) return;
    const words = note.replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 2 && !STOP_WORDS.has(w); });
    const seen = new Set();
    words.forEach(function (w) {
      if (seen.has(w)) return;
      seen.add(w);
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
  });
  const sorted = Object.entries(wordCounts).filter(function (e) { return e[1] >= 2; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
  if (sorted.length === 0) {
    chart.innerHTML = '<p class="insight-chart-empty">Words that show up often (2+ uses) will appear here.</p>';
    block.classList.remove('hidden');
  } else {
    const maxC = sorted[0][1];
    const rows = sorted.map(function (item) {
      var phrase = item[0];
      var count = item[1];
      var w = (count / maxC) * 100;
      var short = phrase.length > 22 ? phrase.slice(0, 19) + '\u2026' : phrase;
      return '<div class="insight-pattern-row"><span class="insight-pattern-label" title="' + escapeHtml(phrase) + '">' + escapeHtml(short) + '</span><div class="insight-pattern-bar-wrap"><div class="insight-pattern-bar insight-pattern-bar--global" style="width:' + w + '%"></div></div><span class="insight-pattern-count">' + count + '\u00D7</span></div>';
    }).join('');
    chart.innerHTML = '<div class="insight-patterns-chart">' + rows + '</div>';
    block.classList.remove('hidden');
  }
}

function exportGlobalPatternsCsv() {
  if (!isUnlocked()) return;
  logStateEvent('action', 'export_global_patterns_csv');
  const source = Array.isArray(lastSharedEntries) ? lastSharedEntries : [];
  const STOP_WORDS = new Set(['a', 'an', 'the', 'is', 'it', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'i', 'me', 'my', 'we', 'be', 'so', 'no', 'or', 'and', 'but', 'if', 'as', 'up', 'do', 'go', 'get', 'got']);
  const wordCounts = {};
  source.forEach(function (row) {
    const note = ((row && row.note) || '').trim().toLowerCase();
    if (note.length < 2) return;
    const words = note.replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 2 && !STOP_WORDS.has(w); });
    const seen = new Set();
    words.forEach(function (w) {
      if (seen.has(w)) return;
      seen.add(w);
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
  });
  const sorted = Object.entries(wordCounts).filter(function (e) { return e[1] >= 2; }).sort(function (a, b) { return b[1] - a[1]; });
  const rows = [['word', 'count']].concat(sorted.map(function (e) { return [e[0], String(e[1])]; }));
  const csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'slipup-global-common-words-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const caption = MODE === 'inside' ? 'All shared moments (global · all time)' : 'All shared entries (global · all time)';
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
      const hasAny = source.length > 0;
      sharedEntriesEmpty.textContent = hasAny
        ? (MODE === 'inside' ? 'No shared moments for this combination. Add one above.' : 'No shared entries for this combination. Add one above.')
        : (MODE === 'inside' ? "No shared moments yet. Add one above to contribute yours." : "No shared entries yet. Add a mistake above to contribute yours.");
      sharedEntriesEmpty.classList.remove('hidden');
      sharedEntriesEmpty.classList.add('empty-state--clickable');
    }
    return;
  }

  if (sharedEntriesEmpty && source.length > 0) {
    sharedEntriesEmpty.classList.add('hidden');
    sharedEntriesEmpty.classList.remove('empty-state--clickable');
  }

  const typeLabels = MODE === 'inside'
    ? { avoidable: 'Heat', fertile: 'Shift', observed: 'Support' }
    : { avoidable: 'Avoidable', fertile: 'Fertile', observed: 'Observed' };
  const themeLabels = { calm: 'Calm', focus: 'Focus', stressed: 'Stressed', curious: 'Curious', tired: 'Tired' };
  filtered.forEach(row => {
    const li = document.createElement('li');
    li.className = 'entry-item';
    const badge = document.createElement('span');
    const type = row.type || 'avoidable';
    let badgeClass = 'badge-avoidable';
    if (type === 'fertile') badgeClass = 'badge-fertile';
    else if (type === 'observed') badgeClass = 'badge-observed';
    badge.className = 'badge ' + badgeClass;
    badge.textContent = typeLabels[type] || typeLabels.avoidable;
    const note = document.createElement('span');
    note.className = 'note' + (row.note ? '' : ' empty');
    note.textContent = row.note || "I couldn't tell";
    if (row.note) {
      note.title = row.note;
      note.dataset.fullNote = row.note;
    }
    const theme = document.createElement('span');
    const tRaw = row.theme || 'calm';
    const t = (tRaw === 'focus' || tRaw === 'stressed' || tRaw === 'curious' || tRaw === 'tired') ? tRaw : 'calm';
    theme.className = 'theme theme--' + t;
    theme.textContent = themeLabels[t] || themeLabels.calm;
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

const SHARED_ENTRIES_LIMITS = [10, 20, 50];

function toggleSharedEntriesView() {
  if (!btnSharedEntriesToggle) return;
  const idx = SHARED_ENTRIES_LIMITS.indexOf(sharedEntriesLimit);
  sharedEntriesLimit = SHARED_ENTRIES_LIMITS[(idx + 1) % SHARED_ENTRIES_LIMITS.length];
  updateSharedEntriesLimitButtons();
  fetchSharedEntries();
}

function showAllSharedEntries() {
  if (!btnShowAllShared) return;
  sharedEntriesLimit = SHARED_ENTRIES_LIMIT_ALL;
  updateSharedEntriesLimitButtons();
  fetchSharedEntries();
}

function updateSharedEntriesLimitButtons() {
  if (btnSharedEntriesToggle) {
    btnSharedEntriesToggle.textContent = 'Last ' + sharedEntriesLimit;
    btnSharedEntriesToggle.setAttribute('aria-label', 'Show last ' + sharedEntriesLimit + ' entries');
    btnSharedEntriesToggle.classList.toggle('active', SHARED_ENTRIES_LIMITS.includes(sharedEntriesLimit));
  }
  if (btnShowAllShared) {
    btnShowAllShared.classList.toggle('active', sharedEntriesLimit >= SHARED_ENTRIES_LIMIT_ALL);
    btnShowAllShared.setAttribute('aria-pressed', sharedEntriesLimit >= SHARED_ENTRIES_LIMIT_ALL ? 'true' : 'false');
  }
}

function applySharedEntriesTypeFilter(value) {
  sharedEntriesTypeFilter = value || 'all';
  logStateEvent('filter_type', sharedEntriesTypeFilter);
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
      logStateEvent('filter_theme', value);
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

async function fetchSharedCountsForInsideButton() {
  if (!topBarSlipups || !SHARING_ENABLED || MODE !== 'inside') return;
  const groupId = getInsideGroupId();
  if (!groupId) return;
  try {
    const client = getSupabase();
    const [totalRes, avoidRes, fertRes, obsRes] = await Promise.all([
      client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('mode', 'inside').eq('group_id', groupId),
      client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('mode', 'inside').eq('group_id', groupId).eq('type', 'avoidable'),
      client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('mode', 'inside').eq('group_id', groupId).eq('type', 'fertile'),
      client.from(ENTRIES_TABLE).select('*', { count: 'exact', head: true }).eq('mode', 'inside').eq('group_id', groupId).eq('type', 'observed')
    ]);
    const getCount = (r) => (r && typeof r.count === 'number' ? r.count : 0);
    const total = getCount(totalRes);
    const globalAvoidable = getCount(avoidRes);
    const globalFertile = getCount(fertRes);
    const globalObserved = getCount(obsRes);
    const a = 'heat';
    const f = 'shift';
    const o = 'support';
    const tooltip = total + ' moments · ' + globalAvoidable + ' ' + a + ', ' + globalFertile + ' ' + f + ', ' + globalObserved + ' ' + o;
    topBarSlipups.setAttribute('aria-label', 'Group moments: ' + total);
    topBarSlipups.title = tooltip;
    topBarSlipups.textContent = '\uD83C\uDF0D ' + total;
  } catch (_) {
    topBarSlipups.textContent = '\uD83C\uDF0D 0';
  }
}

const MILESTONE_THRESHOLDS = [25, 50, 100, 250, 500];
const MILESTONE_STORAGE_KEY = 'slipup-group-milestone-celebrated';

function refreshGroupEngagement() {
  if (MODE !== 'inside') return;
  const groupId = getInsideGroupId();
  const Auth = window.SlipUpInsideAuth;
  if (!groupId || !Auth || !Auth.getGroupParticipationToday || !Auth.getGroupActivitySummary) return;
  const partText = document.getElementById('group-participation-text');
  const partSection = document.getElementById('group-participation-section');
  const activitySummary = document.getElementById('group-activity-summary');
  const activityFeedList = document.getElementById('group-activity-feed-list');
  const activityFeedEmpty = document.getElementById('group-activity-feed-empty');
  Auth.getGroupParticipationToday(groupId).then(function (r) {
    if (partText && partSection) {
      const p = r.participantCount ?? 0;
      const m = r.memberCount ?? 0;
      if (m > 0) {
        partSection.classList.remove('hidden');
        partText.textContent = p > 0 ? (p + ' of ' + m + ' checked in today') : (m > 1 ? '0 of ' + m + ' checked in today — be the first.' : '0 of 1 — add a moment to share with your group.');
      } else {
        partSection.classList.add('hidden');
      }
    }
  });
  Auth.getGroupActivitySummary(groupId).then(function (r) {
    if (activitySummary) {
      const sc = r.sharedCount ?? 0;
      const mc = r.memberCount ?? 0;
      const st = r.sharesToday ?? 0;
      if (mc > 0) activitySummary.textContent = sc + ' shared moments · ' + mc + ' member' + (mc === 1 ? '' : 's') + (st > 0 ? ' · ' + st + ' today' : '');
      else activitySummary.textContent = '';
    }
    if (activityFeedList && activityFeedEmpty) {
      const items = [];
      const pt = r.participantToday ?? 0;
      const mc = r.memberCount ?? 0;
      const sc = r.sharedCount ?? 0;
      const streak = r.streakDays ?? 0;
      if (streak > 0) items.push({ text: 'Group streak: ' + streak + ' day' + (streak === 1 ? '' : 's'), type: 'streak' });
      if (pt > 0 && mc > 0) items.push({ text: pt + ' of ' + mc + ' checked in today', type: 'participation' });
      if (sc >= 25) items.push({ text: 'Group has ' + sc + ' shared moments', type: 'milestone' });
      if (mc > 0) items.push({ text: mc + ' member' + (mc === 1 ? '' : 's') + ' in the group', type: 'members' });
      if (items.length > 0) {
        activityFeedEmpty.classList.add('hidden');
        activityFeedList.innerHTML = items.slice(0, 6).map(function (x) {
          return '<li class="group-activity-feed-item group-activity-feed-item--' + (x.type || '') + '">' + (x.text || '') + '</li>';
        }).join('');
      } else {
        activityFeedList.innerHTML = '';
        activityFeedEmpty.classList.remove('hidden');
      }
    }
    const sharedCount = r.sharedCount ?? 0;
    try {
      const celebrated = JSON.parse(localStorage.getItem(MILESTONE_STORAGE_KEY + '-' + groupId) || '[]');
      const toCelebrate = MILESTONE_THRESHOLDS.find(function (t) { return sharedCount >= t && celebrated.indexOf(t) < 0; });
      if (toCelebrate != null) {
        celebrated.push(toCelebrate);
        localStorage.setItem(MILESTONE_STORAGE_KEY + '-' + groupId, JSON.stringify(celebrated));
        const milestoneSection = document.getElementById('group-milestone-section');
        const milestoneCard = document.getElementById('group-milestone-card');
        if (milestoneSection && milestoneCard) {
          milestoneCard.textContent = 'Group reached ' + toCelebrate + ' shared moments.';
          milestoneSection.classList.remove('hidden');
        }
      }
    } catch (_) {}
  });
}

function initInsideAuth() {
  var btnSignOut = document.getElementById('btn-sign-out');
  var btnInvite = document.getElementById('btn-invite-members');
  var btnInviteHero = document.getElementById('btn-invite-hero');
  var inviteBlock = document.getElementById('group-invite-block');
  var inviteUrlInput = document.getElementById('group-invite-url');
  var btnCopyInvite = document.getElementById('btn-copy-invite');
  var heroGroupBadge = document.getElementById('hero-group-badge');
  var groupSwitcher = document.getElementById('group-switcher');
  var groupInviteMemberCount = document.getElementById('group-invite-member-count');
  var Auth = window.SlipUpInsideAuth;
  if (!Auth) return;
  function updateHeroGroupBadge() {
    if (!heroGroupBadge) return;
    var name = Auth.getActiveGroupName ? Auth.getActiveGroupName() : '';
    heroGroupBadge.textContent = name ? 'Group: ' + name : '';
  }
  updateHeroGroupBadge();
  function updateGroupSwitcher() {
    if (!groupSwitcher) return;
    Auth.getUserGroups().then(function (r) {
      var groups = r.groups || [];
      if (groups.length <= 1) {
        groupSwitcher.classList.add('hidden');
        return;
      }
      groupSwitcher.classList.remove('hidden');
      var currentId = getInsideGroupId();
      groupSwitcher.innerHTML = groups.map(function (g) {
        return '<option value="' + (g.id || '') + '"' + (g.id === currentId ? ' selected' : '') + '>' + (g.name || 'Group') + '</option>';
      }).join('');
    });
  }
  if (groupSwitcher) {
    groupSwitcher.addEventListener('change', function () {
      var opt = groupSwitcher.options[groupSwitcher.selectedIndex];
      if (!opt || !opt.value) return;
      Auth.setActiveGroup(opt.value, opt.text);
      window.SLIPUP_INSIDE_GROUP_ID = opt.value;
      updateHeroGroupBadge();
      if (typeof renderStats === 'function') renderStats();
      if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
      if (typeof renderShareToGroupList === 'function') renderShareToGroupList();
      if (typeof refreshGroupEngagement === 'function') refreshGroupEngagement();
    });
    updateGroupSwitcher();
  }
  if (btnSignOut) {
    btnSignOut.addEventListener('click', function (e) {
      e.preventDefault();
      Auth.clearActiveGroup();
      Auth.getClient().auth.signOut().then(function () {
        window.location.href = 'auth-inside.html';
      });
    });
  }
  function showInviteBlock() {
    var gid = getInsideGroupId();
    if (!gid || !inviteBlock || !inviteUrlInput) return;
    if (groupInviteMemberCount) groupInviteMemberCount.textContent = 'Creating invite…';
    inviteBlock.classList.remove('hidden');
    Auth.createInvite(gid, 30).then(function (r) {
      if (r.error) {
        if (groupInviteMemberCount) groupInviteMemberCount.textContent = r.error;
        if (groupInviteMemberCount) groupInviteMemberCount.classList.add('error');
        return;
      }
      inviteUrlInput.value = r.inviteUrl || '';
      if (groupInviteMemberCount) groupInviteMemberCount.classList.remove('error');
      if (groupInviteMemberCount && Auth.getGroupMemberCount) {
        Auth.getGroupMemberCount(gid).then(function (c) {
          if (c.count != null) groupInviteMemberCount.textContent = c.count + ' member' + (c.count === 1 ? '' : 's') + ' in this group';
          else groupInviteMemberCount.textContent = '';
        });
      }
      inviteBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
  if (btnInvite && Auth.createInvite) btnInvite.addEventListener('click', showInviteBlock);
  if (btnInviteHero && Auth.createInvite) btnInviteHero.addEventListener('click', showInviteBlock);
  if (btnCopyInvite && inviteUrlInput) {
    btnCopyInvite.addEventListener('click', function () {
      inviteUrlInput.select();
      try { navigator.clipboard.writeText(inviteUrlInput.value); } catch (_) {}
    });
  }
}

function initGroupManagement() {
  if (MODE !== 'inside') return;
  var Auth = window.SlipUpInsideAuth;
  if (!Auth || !Auth.getGroupMembers || !Auth.updateGroupName || !Auth.removeMember || !Auth.leaveGroup) return;
  var block = document.getElementById('group-management-block');
  var nameInput = document.getElementById('group-name-edit');
  var btnEditName = document.getElementById('btn-edit-group-name');
  var btnSaveName = document.getElementById('btn-save-group-name');
  var statusEl = document.getElementById('group-management-status');
  var membersList = document.getElementById('group-members-list');
  var membersLoading = document.getElementById('group-members-loading');
  var membersErrorWrap = document.getElementById('group-members-error-wrap');
  var membersError = document.getElementById('group-members-error');
  var btnMembersTryAgain = document.getElementById('btn-members-try-again');
  var invitesSection = document.getElementById('group-invites-section');
  var invitesList = document.getElementById('group-invites-list');
  var invitesLoading = document.getElementById('group-invites-loading');
  var invitesEmpty = document.getElementById('group-invites-empty');
  var btnLeave = document.getElementById('btn-leave-group');
  var btnManage = document.getElementById('btn-manage-group');
  if (!block || !nameInput || !membersList) return;

  var currentUserId = null;
  var isCreator = false;
  var statusTimeout = null;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    if (statusTimeout) clearTimeout(statusTimeout);
    statusEl.textContent = msg || '';
    statusEl.className = 'group-management-status' + (isError ? ' error' : '');
    if (msg && !isError) statusTimeout = setTimeout(function () { setStatus(''); }, 3500);
  }

  function setGroupName(name) {
    if (nameInput) nameInput.value = name || '';
  }

  function loadGroupName() {
    var name = Auth.getActiveGroupName ? Auth.getActiveGroupName() : '';
    setGroupName(name);
  }

  function loadMembers() {
    var gid = getInsideGroupId();
    if (!gid) return;
    if (membersLoading) membersLoading.classList.remove('hidden');
    if (membersErrorWrap) membersErrorWrap.classList.add('hidden');
    if (membersError) membersError.textContent = '';
    membersList.innerHTML = '';
    Promise.all([
      Auth.getClient().auth.getUser(),
      Auth.getGroupMembers(gid)
    ]).then(function (results) {
      var userResult = results[0];
      var membersResult = results[1];
      if (membersLoading) membersLoading.classList.add('hidden');
      currentUserId = userResult?.data?.user?.id || null;
      if (membersResult.error) {
        if (membersError) membersError.textContent = membersResult.error;
        if (membersErrorWrap) membersErrorWrap.classList.remove('hidden');
        return;
      }
      var members = membersResult.members || [];
      isCreator = members.some(function (m) { return m.user_id === currentUserId && m.role === 'creator'; });
      if (btnEditName) btnEditName.classList.toggle('hidden', !isCreator);
      if (nameInput) nameInput.disabled = !isCreator;
      if (!isCreator && btnSaveName) btnSaveName.classList.add('hidden');
      if (invitesSection) invitesSection.classList.toggle('hidden', !isCreator);
      if (isCreator) loadInvites();
      membersList.innerHTML = members.map(function (m) {
        var roleLabel = m.role === 'creator' ? 'Creator' : 'Member';
        var joined = m.joined_at ? new Date(m.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        var isSelf = m.user_id === currentUserId;
        var canRemove = isCreator && !isSelf;
        var canTransfer = isCreator && !isSelf && members.length > 1;
        var removeBtn = canRemove ? '<button type="button" class="btn-remove-member" data-user-id="' + (m.user_id || '') + '">Remove</button>' : '';
        var transferBtn = canTransfer ? '<button type="button" class="btn-transfer-owner" data-user-id="' + (m.user_id || '') + '">Make creator</button>' : '';
        return '<li class="group-member-item" data-user-id="' + (m.user_id || '') + '"><span><span class="group-member-role">' + roleLabel + '</span>' + (isSelf ? ' (you)' : '') + ' · joined ' + joined + '</span>' + removeBtn + transferBtn + '</li>';
      }).join('');
      membersList.querySelectorAll('.btn-remove-member').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var uid = btn.getAttribute('data-user-id');
          if (!uid) return;
          if (!confirm('Remove this member from the group? They will lose access.')) return;
          btn.disabled = true;
          Auth.removeMember(gid, uid).then(function (res) {
            if (res.error) { setStatus(res.error, true); btn.disabled = false; return; }
            setStatus('Member removed.', false);
            loadMembers();
          });
        });
      });
      membersList.querySelectorAll('.btn-transfer-owner').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var uid = btn.getAttribute('data-user-id');
          if (!uid) return;
          if (!confirm('Transfer ownership to this member? You will become a regular member and they will be the creator.')) return;
          btn.disabled = true;
          Auth.transferOwnership && Auth.transferOwnership(gid, uid).then(function (res) {
            if (res.error) { setStatus(res.error, true); btn.disabled = false; return; }
            setStatus('Ownership transferred. Refreshing…', false);
            window.location.reload();
          });
        });
      });
    });
  }

  function loadInvites() {
    var gid = getInsideGroupId();
    if (!gid || !invitesSection || invitesSection.classList.contains('hidden')) return;
    if (invitesLoading) invitesLoading.classList.remove('hidden');
    if (invitesEmpty) invitesEmpty.classList.add('hidden');
    invitesList.innerHTML = '';
    (Auth.getGroupInvites || function () { return Promise.resolve({ invites: [] }); })(gid).then(function (r) {
      if (invitesLoading) invitesLoading.classList.add('hidden');
      var list = r.invites || [];
      if (r.error) {
        if (invitesEmpty) { invitesEmpty.textContent = r.error; invitesEmpty.classList.remove('hidden'); }
        return;
      }
      if (list.length === 0) {
        if (invitesEmpty) { invitesEmpty.textContent = 'No active invites. Use Invite members above to create one.'; invitesEmpty.classList.remove('hidden'); }
        return;
      }
      if (invitesEmpty) invitesEmpty.classList.add('hidden');
      var base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
      invitesList.innerHTML = list.map(function (inv) {
        var url = base + 'inside.html?invite=' + encodeURIComponent(inv.invite_token || '');
        var expiry = inv.expires_at ? 'Expires ' + new Date(inv.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No expiry';
        return '<li class="group-invite-item" data-invite-id="' + (inv.id || '') + '"><span><span class="invite-expiry">' + expiry + '</span> · ' + url.slice(-24) + '…</span><button type="button" class="btn-cancel-invite" data-invite-id="' + (inv.id || '') + '">Cancel</button></li>';
      }).join('');
      invitesList.querySelectorAll('.btn-cancel-invite').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var iid = btn.getAttribute('data-invite-id');
          if (!iid) return;
          if (!confirm('Cancel this invite? The link will stop working.')) return;
          btn.disabled = true;
          (Auth.cancelGroupInvite || function () { return Promise.resolve({ success: false }); })(gid, iid).then(function (res) {
            if (res.error) { setStatus(res.error, true); btn.disabled = false; return; }
            setStatus('Invite cancelled.', false);
            loadInvites();
          });
        });
      });
    });
  }

  function enterEditMode() {
    if (!isCreator) return;
    if (nameInput) nameInput.disabled = false;
    if (btnEditName) btnEditName.classList.add('hidden');
    if (btnSaveName) btnSaveName.classList.remove('hidden');
    if (nameInput) nameInput.focus();
  }

  function exitEditMode() {
    if (nameInput) nameInput.disabled = !isCreator;
    if (btnEditName) btnEditName.classList.remove('hidden');
    if (btnSaveName) btnSaveName.classList.add('hidden');
  }

  function saveGroupName() {
    var gid = getInsideGroupId();
    var raw = (nameInput && nameInput.value || '').trim();
    var name = raw.slice(0, 80) || 'My group';
    if (!gid) return;
    if (!raw || raw.length === 0) {
      setStatus('Enter a group name.', true);
      return;
    }
    btnSaveName.disabled = true;
    Auth.updateGroupName(gid, name).then(function (r) {
      btnSaveName.disabled = false;
      if (r.error) { setStatus(r.error, true); return; }
      Auth.setActiveGroup(gid, r.groupName || name);
      var heroBadge = document.getElementById('hero-group-badge');
      if (heroBadge) heroBadge.textContent = 'Group: ' + (r.groupName || name);
      setStatus('Name updated.', false);
      exitEditMode();
    });
  }

  loadGroupName();
  if (nameInput) nameInput.addEventListener('blur', function () { if (btnSaveName && !btnSaveName.classList.contains('hidden')) saveGroupName(); });
  if (btnEditName) btnEditName.addEventListener('click', enterEditMode);
  if (btnSaveName) btnSaveName.addEventListener('click', saveGroupName);

  if (block) {
    block.addEventListener('toggle', function () {
      if (block.open) loadMembers();
    });
  }

  if (btnLeave) {
    btnLeave.addEventListener('click', function () {
      var gid = getInsideGroupId();
      if (!gid) return;
      if (!confirm('Leave this group? You will lose access to shared moments.')) return;
      btnLeave.disabled = true;
      Auth.leaveGroup(gid).then(function (r) {
        btnLeave.disabled = false;
        if (r.error) { setStatus(r.error, true); return; }
        Auth.clearActiveGroup();
        window.SLIPUP_INSIDE_GROUP_ID = null;
        window.location.reload();
      });
    });
  }

  if (btnManage) {
    btnManage.addEventListener('click', function () {
      if (block) {
        block.open = true;
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
        loadMembers();
      }
    });
  }

  if (btnMembersTryAgain) {
    btnMembersTryAgain.addEventListener('click', loadMembers);
  }
}

function initShareToGroup() {
  if (!shareToGroupSection || MODE !== 'inside') return;
  renderShareToGroupList();
  if (shareToGroupList) {
    shareToGroupList.addEventListener('change', function (e) {
      if (e.target.classList.contains('share-to-group-cb')) updateShareToGroupButton();
    });
  }
  if (btnShareToGroupSelectAll) {
    btnShareToGroupSelectAll.addEventListener('click', function () {
      const unshared = getUnsharedEntries();
      const cbs = shareToGroupList ? shareToGroupList.querySelectorAll('.share-to-group-cb') : [];
      const allChecked = cbs.length > 0 && Array.from(cbs).every(cb => cb.checked);
      cbs.forEach(cb => { cb.checked = !allChecked; });
      updateShareToGroupButton();
    });
  }
  if (btnShareToGroup) {
    btnShareToGroup.addEventListener('click', function () { shareSelectedToGroup(); });
  }
}

function initSharing() {
  if (!shareSection && MODE !== 'inside') return;
  if (MODE === 'inside' && !shareSection) {
    if (topBarSlipups) {
      topBarSlipups.textContent = '\uD83C\uDF0D 0';
      topBarSlipups.setAttribute('aria-label', 'Group moments: 0');
      if (SHARING_ENABLED) {
        topBarSlipups.style.display = '';
        fetchSharedCountsForInsideButton();
      } else {
        topBarSlipups.style.display = 'none';
      }
    }
    if (SHARING_ENABLED && communityEntriesSection) {
      communityEntriesSection.classList.remove('hidden');
      if (btnSharedEntriesToggle) btnSharedEntriesToggle.addEventListener('click', function () { logStateEvent('action', 'shared_entries_toggle'); toggleSharedEntriesView(); });
      if (btnShowAllShared) btnShowAllShared.addEventListener('click', function () { logStateEvent('action', 'show_all_shared'); showAllSharedEntries(); });
      if (sharedEntriesFilters) sharedEntriesFilters.addEventListener('click', handleSharedEntriesFilterClick);
      if (btnAddFromCommunity) {
        btnAddFromCommunity.addEventListener('click', function () {
          if (typeof switchToPhase === 'function' && personalView) switchToPhase('personal');
          var main = document.getElementById('main');
          if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (addNoteInput) setTimeout(function () { addNoteInput.focus(); }, 300);
        });
      }
      sharedEntriesLimit = 10;
      updateSharedEntriesLimitButtons();
      fetchSharedEntries();
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible' && SHARING_ENABLED && typeof fetchSharedEntries === 'function') {
            fetchSharedEntries();
          }
        });
      }
    }
    return;
  }
  if (topBarShare) topBarShare.style.display = SHARING_ENABLED ? '' : 'none';
  if (topBarWorld) topBarWorld.style.display = SHARING_ENABLED ? '' : 'none';
  if (topBarSlipups) topBarSlipups.style.display = SHARING_ENABLED ? '' : 'none';
  if (SHARING_ENABLED) {
    if (socialBlock) socialBlock.classList.remove('hidden');
    shareSection.classList.remove('hidden');
    if (communitySection) communitySection.classList.remove('hidden');
    var socialTab = document.querySelector('.phase-tab[data-phase="social"]');
    if (socialTab) socialTab.style.display = '';
    if (socialToShare) {
      socialToShare.classList.remove('hidden');
      updateSocialToShare();
    }
  } else {
    if (socialBlock) socialBlock.classList.add('hidden');
    var socialTab = document.querySelector('.phase-tab[data-phase="social"]');
    if (socialTab) socialTab.style.display = 'none';
    if (socialToShare) socialToShare.classList.add('hidden');
    if (topBarShare) topBarShare.style.display = 'none';
    if (topBarWorld) topBarWorld.style.display = 'none';
    if (topBarSlipups) topBarSlipups.style.display = 'none';
  }
  if (btnShare) btnShare.addEventListener('click', shareAnonymously);
  if (btnRefreshFeed) btnRefreshFeed.addEventListener('click', function () { logStateEvent('action', 'refresh_feed'); fetchSharedStats(); });
  fetchSharedStats();
  if (SHARING_ENABLED && communityEntriesSection) {
    communityEntriesSection.classList.remove('hidden');
    if (btnRefreshEntries) btnRefreshEntries.addEventListener('click', function () { logStateEvent('action', 'refresh_entries'); fetchSharedEntries(); });
    if (btnSharedEntriesToggle) btnSharedEntriesToggle.addEventListener('click', function () { logStateEvent('action', 'shared_entries_toggle'); toggleSharedEntriesView(); });
    if (btnShowAllShared) btnShowAllShared.addEventListener('click', function () { logStateEvent('action', 'show_all_shared'); showAllSharedEntries(); });
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
        if (typeof switchToPhase === 'function' && personalView) {
          switchToPhase('personal');
        }
        const main = document.getElementById('main');
        if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (addNoteInput) setTimeout(function () { addNoteInput.focus(); }, 300);
      });
    }
    if (sharedEntriesEmpty) {
      function goAddFromSharedEmpty() {
        if (!sharedEntriesEmpty.classList.contains('empty-state--clickable')) return;
        if (typeof switchToPhase === 'function' && personalView) {
          switchToPhase('personal');
        }
        const main = document.getElementById('main');
        if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (addNoteInput) setTimeout(function () { addNoteInput.focus(); }, 300);
      }
      sharedEntriesEmpty.addEventListener('click', function () {
        logStateEvent('action', 'add_from_empty');
        goAddFromSharedEmpty();
      });
      sharedEntriesEmpty.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        logStateEvent('action', 'add_from_empty');
        goAddFromSharedEmpty();
      });
      sharedEntriesEmpty.setAttribute('role', 'button');
      sharedEntriesEmpty.setAttribute('tabindex', '0');
    }
    // Start with the recent slice (last 10).
    sharedEntriesLimit = 10;
    updateSharedEntriesLimitButtons();
    fetchSharedEntries();
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && SHARING_ENABLED && typeof fetchSharedEntries === 'function') {
          fetchSharedEntries();
        }
      });
    }
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
  if (reflectionIntentionMatch) {
    reflectionIntentionMatch.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest('.reflection-intention-btn');
      if (!btn) return;
      const val = btn.dataset.value || '';
      updateReflection('intentionMatch', val);
      const btns = reflectionIntentionMatch.querySelectorAll('.reflection-intention-btn');
      btns.forEach(function (b) {
        b.classList.toggle('selected', (b.dataset.value || '') === val);
      });
    });
  }
}

const MICRO_GOAL_MAXLEN = 13;
function updateMicroGoalCharCount() {
  if (!microGoalCharCount || !microGoalInput) return;
  const n = microGoalInput.value.length;
  microGoalCharCount.textContent = n + '/' + MICRO_GOAL_MAXLEN;
}
function initMicroGoal() {
  if (!microGoalInput) return;
  if (microGoalHint && MODE !== 'inside') {
    microGoalHint.textContent = SHARING_ENABLED
      ? "Anonymous — no name. Tap Share intention to add yours to the Social chart."
      : 'Just for you — stays on your device.';
  }
  microGoalInput.setAttribute('maxlength', String(MICRO_GOAL_MAXLEN));
  microGoalInput.value = loadMicroGoal();
  updateMicroGoalCharCount();
  microGoalInput.addEventListener('input', () => {
    if (microGoalInput.value.length > MICRO_GOAL_MAXLEN) microGoalInput.value = microGoalInput.value.slice(0, MICRO_GOAL_MAXLEN);
    updateMicroGoalCharCount();
    renderMicroGoal();
  });
  microGoalInput.addEventListener('paste', () => {
    setTimeout(() => {
      if (microGoalInput.value.length > MICRO_GOAL_MAXLEN) microGoalInput.value = microGoalInput.value.slice(0, MICRO_GOAL_MAXLEN);
      updateMicroGoalCharCount();
      renderMicroGoal();
    }, 0);
  });
  microGoalInput.addEventListener('blur', () => {
    saveMicroGoal(microGoalInput.value);
    renderMicroGoal();
    renderReflection();
  });
  if (SHARING_ENABLED && sharedIntentionsBlock) fetchSharedIntentions();
  if (btnShareIntention) {
    if (MODE === 'personal' && !SHARING_ENABLED) {
      btnShareIntention.classList.add('hidden');
    }
    btnShareIntention.addEventListener('click', () => {
      const val = (microGoalInput && microGoalInput.value || '').trim();
      if (!val) return;
      saveMicroGoal(val);
      lastPushedIntention = val;
      pushIntentionToShared(val);
      btnShareIntention.classList.add('shared');
      btnShareIntention.textContent = 'Shared';
      if (typeof fetchSharedIntentions === 'function') fetchSharedIntentions();
    });
  }
  if (btnViewOlderIntentions) {
    let showingOlder = false;
    btnViewOlderIntentions.addEventListener('click', () => {
      showingOlder = !showingOlder;
      fetchSharedIntentions({ includeOlder: showingOlder });
    });
  }
  var btnIntentionsHow = document.getElementById('btn-intentions-how');
  var intentionsHowPanel = document.getElementById('shared-intentions-how-panel');
  if (btnIntentionsHow && intentionsHowPanel) {
    if (MODE === 'inside') {
      intentionsHowPanel.textContent = "Tap Share intention to add yours here. Everyone in your group can see shared intentions.";
    }
    btnIntentionsHow.addEventListener('click', () => {
      var open = intentionsHowPanel.classList.toggle('hidden');
      btnIntentionsHow.setAttribute('aria-expanded', !open);
      if (!open) logStateEvent('action', 'intentions_how_click');
    });
  }
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
    logStateEvent('action', 'add_to_home_dismiss');
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
    logStateEvent('action', enabled ? 'reminder_on' : 'reminder_off');
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
    updateMistakeNoteCharCount();
  });
  addNoteInput.addEventListener('keyup', updateAddButtonState);
  addNoteInput.addEventListener('paste', () => {
    setTimeout(() => {
      if (addNoteInput.value.length > MISTAKE_NOTE_MAXLEN) addNoteInput.value = addNoteInput.value.slice(0, MISTAKE_NOTE_MAXLEN);
      updateAddButtonState();
      updateMistakeNoteCharCount();
    }, 0);
  });
  updateMistakeNoteCharCount();
}
function updateMistakeNoteCharCount() {
  const el = document.getElementById('mistake-note-char-count');
  if (!el) return;
  if (addNoteInput) el.textContent = addNoteInput.value.length + '/' + MISTAKE_NOTE_MAXLEN;
  var type = typeof getSelectedType === 'function' ? getSelectedType() : 'observed';
  el.classList.remove('add-card-char-count--avoidable', 'add-card-char-count--fertile', 'add-card-char-count--observed');
  el.classList.add('add-card-char-count--' + type);
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
  updateMistakeNoteCharCount();
}

function openBiasCheck() {
  if (!biasCheckOverlay || !biasCheckOptions || !biasCheckReflection) return;
  logStateEvent('action', 'bias_check_open');
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
  if (lastBiasCheckReason) logStateEvent('bias_reason', lastBiasCheckReason);
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
    logStateEvent('filter_type_personal', type);
    const buttons = historyFilters.querySelectorAll('.history-filter');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn === target);
    });
    renderList();
  });
}

if (btnExportReflections) {
  btnExportReflections.addEventListener('click', () => { if (isUnlocked()) exportReflectionsCsv(); });
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => { if (isUnlocked()) exportCsv(); });
}
var btnDownloadGlobalPatterns = document.getElementById('btn-download-global-patterns');
if (btnDownloadGlobalPatterns) {
  btnDownloadGlobalPatterns.addEventListener('click', function () { if (isUnlocked()) exportGlobalPatternsCsv(); });
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
if (MODE === 'inside') {
  initShareToGroup();
  initInsideAuth();
  initGroupManagement();
  setTimeout(function () { if (typeof refreshGroupEngagement === 'function') refreshGroupEngagement(); }, 500);
}
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
    if (personalView && socialView && personalView.classList.contains('hidden') && typeof switchToPhase === 'function') {
      switchToPhase('personal');
    }
    const main = document.getElementById('main');
    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (addNoteInput) setTimeout(function () { addNoteInput.focus(); }, 300);
  });
}
var topBarBrand = document.getElementById('top-bar-brand');
if (topBarBrand) {
  topBarBrand.addEventListener('click', function (e) {
    var p = (window.location.pathname || '').toLowerCase();
    var onIndex = !p || p === '/' || p === '/index.html' || p.endsWith('/') || p.endsWith('/index.html') || /\/index\.html(\?|#|$)/.test(p);
    if (onIndex) {
      e.preventDefault();
      e.stopPropagation();
      function doReload() {
        var u = new URL('index.html', window.location.href);
        u.searchParams.set('_', String(Date.now()));
        u.hash = '';
        window.location.replace(u.toString());
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function (r) {
          if (!r) { doReload(); return; }
          if (r.waiting) r.waiting.postMessage({ type: 'skipWaiting' });
          r.update();
          var done = false;
          function finish() {
            if (done) return;
            done = true;
            navigator.serviceWorker.removeEventListener('controllerchange', onNew);
            doReload();
          }
          function onNew() { finish(); }
          navigator.serviceWorker.addEventListener('controllerchange', onNew);
          setTimeout(finish, 1500);
        }).catch(function () { doReload(); });
      } else {
        doReload();
      }
    }
  }, true);
}
if (topBarShare) {
  topBarShare.addEventListener('click', function (e) {
    e.preventDefault();
    if (!socialView || !personalView) return;
    if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
    switchToPhase('social');
    switchToSocialTab('share');
  });
}
if (topBarWorld) {
  const communityEntriesCard = document.getElementById('community-entries-card');
  topBarWorld.addEventListener('click', function (e) {
    e.preventDefault();
    if (!socialView || !personalView) return;
    if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
    switchToPhase('social');
    switchToSocialTab('world');
    if (communityEntriesCard) {
      requestAnimationFrame(function () {
        communityEntriesCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });
}
if (topBarSlipups) {
  const communityEntriesCardInside = document.getElementById('community-entries-card');
  topBarSlipups.addEventListener('click', function (e) {
    e.preventDefault();
    if (MODE === 'inside') {
      if (socialView && personalView) {
        switchToPhase('social');
        if (communityEntriesCardInside) {
          requestAnimationFrame(function () {
            communityEntriesCardInside.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      } else {
        var target = document.getElementById('progress-section') || document.getElementById('trends-section');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
}
var btnGlobalWorld = document.querySelector('.btn-global-world');
if (btnGlobalWorld) {
  var communityEntriesCardForWorld = document.getElementById('community-entries-card');
  btnGlobalWorld.addEventListener('click', function (e) {
    e.preventDefault();
    if (MODE === 'inside') {
      if (socialView && personalView) {
        switchToPhase('social');
        if (communityEntriesCardForWorld) {
          requestAnimationFrame(function () {
            communityEntriesCardForWorld.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      }
      return;
    }
    if (!socialView || !personalView) return;
    if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
    switchToPhase('social');
    switchToSocialTab('world');
    if (communityEntriesCardForWorld) {
      requestAnimationFrame(function () {
        communityEntriesCardForWorld.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });
}
var btnLinkRecentShares = document.getElementById('btn-link-recent-shares');
if (btnLinkRecentShares) {
  btnLinkRecentShares.addEventListener('click', function (e) {
    e.preventDefault();
    if (!socialView || !personalView) return;
    switchToPhase('social');
    if (typeof switchToSocialTab === 'function') switchToSocialTab('share');
    if (communitySection) {
      requestAnimationFrame(function () {
        communitySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });
}
var btnLinkAddMistake = document.getElementById('btn-link-add-mistake');
if (btnLinkAddMistake) {
  btnLinkAddMistake.addEventListener('click', function (e) {
    e.preventDefault();
    if (!personalView) return;
    switchToPhase('personal');
    if (addNoteInput) {
      requestAnimationFrame(function () {
        addNoteInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { addNoteInput.focus(); }, 300);
      });
    }
  });
}

function switchToPhase(phase) {
  if (!personalView || !socialView) return;
  logStateEvent('phase', phase, { source: phase + '_view' });
  const tabs = document.querySelectorAll('.phase-tab');
  if (phase === 'personal') {
    personalView.classList.remove('hidden');
    socialView.classList.add('hidden');
    tabs.forEach(function (t) {
      const isActive = t.getAttribute('data-phase') === 'personal';
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });
    if (history.replaceState) history.replaceState(null, '', window.location.pathname + window.location.search);
  } else {
    personalView.classList.add('hidden');
    socialView.classList.remove('hidden');
    switchToSocialTab('share');
    if (typeof renderMicroGoal === 'function') renderMicroGoal();
    if (MODE === 'personal') {
      if (typeof fetchSharedIntentions === 'function') fetchSharedIntentions();
      if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
    }
    if (MODE === 'inside') {
      if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
      if (typeof refreshGroupEngagement === 'function') refreshGroupEngagement();
    }
    tabs.forEach(function (t) {
      const isActive = t.getAttribute('data-phase') === 'social';
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });
    if (history.replaceState) history.replaceState(null, '', (window.location.pathname || '/') + '#social');
  }
}

function applyHashPhase() {
  if (!personalView || !socialView) return;
  var hash = (window.location.hash || '').toLowerCase();
  if (hash === '#social') {
    switchToPhase('social');
    if (MODE === 'inside') {
      var card = document.getElementById('community-entries-card');
      if (card) requestAnimationFrame(function () { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }
  } else if (hash === '#community-section' && typeof switchToSocialTab === 'function') {
    switchToPhase('social');
    switchToSocialTab('share');
    var section = document.getElementById('community-section');
    if (section) requestAnimationFrame(function () { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  } else if (hash === '#phase-tabs' && typeof switchToSocialTab === 'function') {
    switchToPhase('social');
    switchToSocialTab('world');
    var card = document.getElementById('community-entries-card');
    if (card) requestAnimationFrame(function () { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
}
(function initPhaseTabs() {
  const tabs = document.querySelectorAll('.phase-tab');
  if (!tabs.length || !personalView || !socialView) return;
  applyHashPhase();
  window.addEventListener('hashchange', applyHashPhase);
  tabs.forEach(function (t) {
    if (t.getAttribute('data-phase') == null) return;
    t.addEventListener('click', function () {
      var phase = t.getAttribute('data-phase');
      if (phase) switchToPhase(phase);
    });
  });
})();

function switchToSocialTab(tab) {
  var panelShare = document.getElementById('social-tab-share');
  var panelWorld = document.getElementById('social-tab-world');
  if (!panelShare || !panelWorld) return;
  if (tab === 'world') {
    logStateEvent('social_tab', 'world');
    panelShare.classList.add('hidden');
    panelShare.setAttribute('aria-hidden', 'true');
    panelWorld.classList.remove('hidden');
    panelWorld.setAttribute('aria-hidden', 'false');
    if (typeof fetchSharedEntries === 'function') fetchSharedEntries();
  } else {
    panelWorld.classList.add('hidden');
    panelWorld.setAttribute('aria-hidden', 'true');
    panelShare.classList.remove('hidden');
    panelShare.setAttribute('aria-hidden', 'false');
  }
}

if (btnBuy && PAYMENT_URL) {
  btnBuy.href = PAYMENT_URL;
  btnBuy.classList.remove('hidden');
} else if (btnBuy) {
  btnBuy.classList.add('hidden');
}
if (btnBuy) {
  btnBuy.addEventListener('click', function(e) {
    if (PAYMENT_URL) logStateEvent('action', 'payment_click');
    if (!PAYMENT_URL) e.preventDefault();
    else setPaymentLinkClicked();
    if (PAYMENT_URL) setTimeout(updateUpgradeUI, 0);
  });
}
if (btnBuyUnlocked) {
  btnBuyUnlocked.addEventListener('click', function() {
    logStateEvent('action', 'payment_click');
    setPaymentLinkClicked();
    setTimeout(updateUpgradeUI, 0);
  });
}

if (btnUnlockAfterPay) {
  btnUnlockAfterPay.addEventListener('click', function() {
    logStateEvent('action', 'unlock_click');
    setUnlocked();
  });
}

