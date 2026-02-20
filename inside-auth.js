/**
 * SlipUp Inside — Auth and group gate
 * Used on auth-inside.html (login/signup) and inside.html (bootstrap + group gate)
 */
(function () {
  'use strict';

  const CONFIG = window.MISTAKE_TRACKER_CONFIG || {};
  const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const SUPABASE_ANON_KEY = (CONFIG.SUPABASE_ANON_KEY || '').trim();
  const AUTH_ENABLED = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

  const GROUP_STORAGE_KEY = 'slipup-inside-group-id';
  const GROUP_NAME_STORAGE_KEY = 'slipup-inside-group-name';
  /* Use localStorage so group persists across PWA reopens; sessionStorage clears when app is killed */
  const GROUP_STORAGE = typeof localStorage !== 'undefined' ? localStorage : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);

  function getClient() {
    if (!AUTH_ENABLED || typeof supabase === 'undefined') return null;
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }

  /** Check current auth session. Returns { session, user, error } */
  async function getSession() {
    const client = getClient();
    if (!client) return { session: null, user: null, error: 'Supabase not configured' };
    const { data: { session }, error } = await client.auth.getSession();
    return { session, user: session?.user ?? null, error: error?.message };
  }

  /** Get user's groups. Returns { groups: [...], error } */
  async function getUserGroups() {
    const client = getClient();
    if (!client) return { groups: [], error: 'Supabase not configured' };
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { groups: [], error: 'Not authenticated' };
    const { data, error } = await client
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', user.id);
    if (error) return { groups: [], error: error.message };
    const rows = data || [];
    const groups = rows
      .filter(r => r.groups)
      .map(r => ({ id: r.group_id, name: r.groups.name || 'Group' }));
    return { groups, error: null };
  }

  /** Join group via invite token. Returns { success, groupId, groupName, error } */
  async function joinByInvite(token) {
    const client = getClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    const { data, error } = await client.rpc('join_group_by_invite', { invite_token: token });
    if (error) return { success: false, error: error.message };
    const ok = data && data.success === true;
    if (!ok) return { success: false, error: data?.error || 'Failed' };
    let groupName = '';
    try {
      const { data: g } = await client.from('groups').select('name').eq('id', data.group_id).single();
      if (g && g.name) groupName = g.name;
    } catch (_) {}
    return { success: true, groupId: data.group_id, groupName, error: null };
  }

  /** Create group and add creator (via RPC to avoid RLS issues). Returns { groupId, groupName, error } */
  async function createGroup(name) {
    const client = getClient();
    if (!client) return { groupId: null, groupName: null, error: 'Supabase not configured' };
    const trimmed = (name || '').trim().slice(0, 80) || 'My group';
    const { data, error } = await client.rpc('create_group', { group_name: trimmed });
    if (error) return { groupId: null, groupName: null, error: error.message };
    if (!data || !data.success) return { groupId: null, groupName: null, error: data?.error || 'Failed to create group' };
    return { groupId: data.group_id, groupName: data.group_name || trimmed, error: null };
  }

  /** Get participation today (X of Y checked in). Returns { participantCount, memberCount, error } */
  async function getGroupParticipationToday(groupId) {
    const client = getClient();
    if (!client || !groupId) return { participantCount: 0, memberCount: 0, error: 'Not configured' };
    const useEntriesInside = true; // Config could toggle; shared_entries_inside is default for Inside
    const { data, error } = await client.rpc('get_group_participation_today', { p_group_id: groupId, p_use_entries_inside: useEntriesInside });
    if (error) return { participantCount: 0, memberCount: 0, error: error.message };
    return {
      participantCount: data?.participant_count ?? 0,
      memberCount: data?.member_count ?? 0,
      error: null
    };
  }

  /** Get group streak (consecutive days with shares). Returns { streak, error } */
  async function getGroupStreakDays(groupId) {
    const client = getClient();
    if (!client || !groupId) return { streak: 0, error: 'Not configured' };
    const { data, error } = await client.rpc('get_group_streak_days', { p_group_id: groupId });
    if (error) return { streak: 0, error: error.message };
    return { streak: typeof data === 'number' ? data : 0, error: null };
  }

  /** Get group activity summary for feed. Returns { memberCount, sharedCount, participantToday, sharesToday, error } */
  async function getGroupActivitySummary(groupId) {
    const client = getClient();
    if (!client || !groupId) return { memberCount: 0, sharedCount: 0, participantToday: 0, sharesToday: 0, error: 'Not configured' };
    const { data, error } = await client.rpc('get_group_activity_summary', { p_group_id: groupId });
    if (error) return { memberCount: 0, sharedCount: 0, participantToday: 0, sharesToday: 0, error: error.message };
    return {
      memberCount: data?.member_count ?? 0,
      sharedCount: data?.shared_count ?? 0,
      participantToday: data?.participant_today ?? 0,
      sharesToday: data?.shares_today ?? 0,
      streakDays: data?.streak_days ?? 0,
      error: null
    };
  }

  /** Get member count for a group (must be member). Returns { count, error } */
  async function getGroupMemberCount(groupId) {
    const client = getClient();
    if (!client || !groupId) return { count: null, error: 'Not configured' };
    const { data, error } = await client.rpc('get_group_member_count', { p_group_id: groupId });
    if (error) return { count: null, error: error.message };
    return { count: data != null ? data : null, error: null };
  }

  /** Validate that user is still in the given group. Returns { valid, error } */
  async function validateGroupMembership(groupId) {
    const { groups } = await getUserGroups();
    const ok = groups && groups.some(g => g.id === groupId);
    return { valid: !!ok, error: null };
  }

  /** Update group name (creator only). Returns { success, groupName, error } */
  async function updateGroupName(groupId, name) {
    const client = getClient();
    if (!client || !groupId) return { success: false, error: 'Not configured' };
    const { data, error } = await client.rpc('update_group_name', { p_group_id: groupId, p_name: (name || '').trim().slice(0, 80) });
    if (error) return { success: false, error: error.message };
    if (!data || !data.success) return { success: false, error: data?.error || 'Failed to update' };
    return { success: true, groupName: data.group_name, error: null };
  }

  /** Get members of a group. Returns { members: [{ user_id, role, joined_at }], error } */
  async function getGroupMembers(groupId) {
    const client = getClient();
    if (!client || !groupId) return { members: [], error: 'Not configured' };
    const { data, error } = await client.rpc('get_group_members', { p_group_id: groupId });
    if (error) return { members: [], error: error.message };
    if (data?.error) return { members: [], error: data.error };
    let list = data?.members;
    if (!Array.isArray(list) && list) list = typeof list === 'string' ? JSON.parse(list) : [];
    return { members: list || [], error: null };
  }

  /** Remove a member (creator only). Returns { success, error } */
  async function removeMember(groupId, userId) {
    const client = getClient();
    if (!client || !groupId || !userId) return { success: false, error: 'Not configured' };
    const { data, error } = await client.rpc('remove_member', { p_group_id: groupId, p_user_id: userId });
    if (error) return { success: false, error: error.message };
    if (!data || !data.success) return { success: false, error: data?.error || 'Failed to remove' };
    return { success: true, error: null };
  }

  /** Leave group. Returns { success, error } */
  async function leaveGroup(groupId) {
    const client = getClient();
    if (!client || !groupId) return { success: false, error: 'Not configured' };
    const { data, error } = await client.rpc('leave_group', { p_group_id: groupId });
    if (error) return { success: false, error: error.message };
    if (!data || !data.success) return { success: false, error: data?.error || 'Failed to leave' };
    return { success: true, error: null };
  }

  /** Transfer ownership to another member (creator only). Returns { success, error } */
  async function transferOwnership(groupId, newCreatorUserId) {
    const client = getClient();
    if (!client || !groupId || !newCreatorUserId) return { success: false, error: 'Not configured' };
    const { data, error } = await client.rpc('transfer_ownership', { p_group_id: groupId, p_new_creator_user_id: newCreatorUserId });
    if (error) return { success: false, error: error.message };
    if (!data || !data.success) return { success: false, error: data?.error || 'Failed to transfer' };
    return { success: true, error: null };
  }

  /** Get active invites for a group (creator only). Returns { invites: [...], error } */
  async function getGroupInvites(groupId) {
    const client = getClient();
    if (!client || !groupId) return { invites: [], error: 'Not configured' };
    const { data, error } = await client.rpc('get_group_invites', { p_group_id: groupId });
    if (error) return { invites: [], error: error.message };
    if (data?.error) return { invites: [], error: data.error };
    const list = Array.isArray(data?.invites) ? data.invites : [];
    return { invites: list, error: null };
  }

  /** Cancel an invite (creator only). Returns { success, error } */
  async function cancelGroupInvite(groupId, inviteId) {
    const client = getClient();
    if (!client || !groupId || !inviteId) return { success: false, error: 'Not configured' };
    const { data, error } = await client.rpc('cancel_group_invite', { p_group_id: groupId, p_invite_id: inviteId });
    if (error) return { success: false, error: error.message };
    if (!data || !data.success) return { success: false, error: data?.error || 'Failed to cancel' };
    return { success: true, error: null };
  }

  /** Get invite preview (group name + member count) without joining. Returns { exists, groupName, memberCount, expired, error } */
  async function getInvitePreview(token) {
    const client = getClient();
    if (!client) return { exists: false, error: 'Supabase not configured' };
    if (!token) return { exists: false, error: 'Token required' };
    const { data, error } = await client.rpc('get_invite_preview', { p_token: token });
    if (error) return { exists: false, error: error.message };
    if (!data) return { exists: false };
    if (!data.exists) return { exists: false };
    return {
      exists: true,
      groupName: data.group_name || 'Group',
      memberCount: data.member_count ?? 0,
      expired: !!data.expired,
      error: null
    };
  }

  /** Create invite for group. Returns { inviteUrl, token, error } */
  async function createInvite(groupId, expiresInDays) {
    const client = getClient();
    if (!client) return { inviteUrl: null, token: null, error: 'Supabase not configured' };
    const token = crypto.randomUUID ? crypto.randomUUID() : 'inv-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + expiresInDays);
      expiresAt = d.toISOString();
    }
    const { data: { user } } = await client.auth.getUser();
    const { error } = await client.from('group_invites').insert({
      group_id: groupId,
      invite_token: token,
      invited_by: user?.id ?? null,
      expires_at: expiresAt
    });
    if (error) return { inviteUrl: null, token: null, error: error.message };
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const inviteUrl = base + 'inside.html?invite=' + encodeURIComponent(token);
    return { inviteUrl, token, error: null };
  }

  /** Store selected group for app */
  function setActiveGroup(groupId, groupName) {
    if (!GROUP_STORAGE) return;
    try {
      GROUP_STORAGE.setItem(GROUP_STORAGE_KEY, groupId);
      GROUP_STORAGE.setItem(GROUP_NAME_STORAGE_KEY, groupName || '');
    } catch (_) {}
  }

  /** Get stored group id */
  function getActiveGroupId() {
    if (!GROUP_STORAGE) return null;
    try {
      return GROUP_STORAGE.getItem(GROUP_STORAGE_KEY) || null;
    } catch (_) {
      return null;
    }
  }

  /** Get stored group name */
  function getActiveGroupName() {
    if (!GROUP_STORAGE) return '';
    try {
      return GROUP_STORAGE.getItem(GROUP_NAME_STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  /** Clear stored group (e.g. on sign out) */
  function clearActiveGroup() {
    if (!GROUP_STORAGE) return;
    try {
      GROUP_STORAGE.removeItem(GROUP_STORAGE_KEY);
      GROUP_STORAGE.removeItem(GROUP_NAME_STORAGE_KEY);
    } catch (_) {}
  }

  // Expose for app.js
  window.SlipUpInsideAuth = {
    getSession,
    getUserGroups,
    getGroupMemberCount,
    getGroupMembers,
    getInvitePreview,
    getGroupParticipationToday,
    getGroupActivitySummary,
    getGroupStreakDays,
    validateGroupMembership,
    joinByInvite,
    createGroup,
    createInvite,
    updateGroupName,
    removeMember,
    leaveGroup,
    transferOwnership,
    getGroupInvites,
    cancelGroupInvite,
    setActiveGroup,
    getActiveGroupId,
    getActiveGroupName,
    clearActiveGroup,
    getClient,
    AUTH_ENABLED,
    GROUP_STORAGE_KEY
  };

  // ---- Auth page (auth-inside.html) ----
  const form = document.getElementById('auth-form');
  const tabSignIn = document.getElementById('tab-signin');
  const tabSignUp = document.getElementById('tab-signup');
  const fieldConfirm = document.getElementById('field-confirm');
  const authConfirm = document.getElementById('auth-confirm');
  const authError = document.getElementById('auth-error');
  const authSuccess = document.getElementById('auth-success');
  const authSubmit = document.getElementById('auth-submit');
  const btnMagic = document.getElementById('auth-magic');

  if (!form) return; // Not on auth page

  let authMode = 'signin';

  function showError(msg) {
    if (authError) {
      authError.textContent = msg || '';
      authError.classList.toggle('hidden', !msg);
    }
    if (authSuccess) authSuccess.classList.add('hidden');
  }

  function showSuccess(msg) {
    if (authSuccess) {
      authSuccess.textContent = msg || '';
      authSuccess.classList.toggle('hidden', !msg);
    }
    if (authError) authError.classList.add('hidden');
  }

  function setLoading(loading) {
    if (authSubmit) authSubmit.disabled = loading;
    if (btnMagic) btnMagic.disabled = loading;
  }

  function setMode(mode) {
    authMode = mode;
    if (tabSignIn) tabSignIn.classList.toggle('active', mode === 'signin');
    if (tabSignUp) tabSignUp.classList.toggle('active', mode === 'signup');
    if (fieldConfirm) fieldConfirm.classList.toggle('hidden', mode === 'signin');
    if (authConfirm) authConfirm.required = mode === 'signup';
    if (authSubmit) authSubmit.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    showError('');
    showSuccess('');
  }

  if (tabSignIn) tabSignIn.addEventListener('click', () => setMode('signin'));
  if (tabSignUp) tabSignUp.addEventListener('click', () => setMode('signup'));

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    showError('');
    showSuccess('');
    const email = (document.getElementById('auth-email')?.value || '').trim();
    const password = document.getElementById('auth-password')?.value || '';
    const confirm = document.getElementById('auth-confirm')?.value || '';
    if (!email || !password) {
      showError('Email and password are required.');
      return;
    }
    if (authMode === 'signup' && password !== confirm) {
      showError('Passwords do not match.');
      return;
    }
    if (authMode === 'signup' && password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }
    const client = getClient();
    if (!client) {
      showError('SlipUp Inside is not configured. Add Supabase URL and anon key to config.js.');
      return;
    }
    setLoading(true);
    try {
      if (authMode === 'signin') {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showSuccess('Signed in. Redirecting…');
        const returnTo = new URLSearchParams(window.location.search).get('return') || 'inside.html';
        window.location.href = returnTo;
      } else {
        const { error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        showSuccess('Account created. Check your email to confirm, or sign in if already verified.');
      }
    } catch (err) {
      showError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  });

  if (btnMagic) {
    btnMagic.addEventListener('click', async function () {
      showError('');
      showSuccess('');
      const email = (document.getElementById('auth-email')?.value || '').trim();
      if (!email) {
        showError('Enter your email first.');
        return;
      }
      const client = getClient();
      if (!client) {
        showError('SlipUp Inside is not configured.');
        return;
      }
      setLoading(true);
      try {
        const { error } = await client.auth.signInWithOtp({ email });
        if (error) throw error;
        showSuccess('Check your email for the magic link.');
      } catch (err) {
        showError(err?.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    });
  }
})();
