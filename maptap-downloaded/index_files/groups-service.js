/**
 * Groups Service - API client for MapTap Groups feature
 *
 * Provides functions to interact with the Groups Cloud Functions.
 * Uses Firebase callable functions for authenticated operations.
 *
 * See /groups.md for full feature specification.
 */

// Firebase Functions region (must match deployment)
const FUNCTIONS_REGION = 'us-central1';

// Base URL for HTTP functions
const FUNCTIONS_BASE_URL = 'https://us-central1-jjexperiment-12af6.cloudfunctions.net';

/**
 * Initialize the groups service
 * Must be called after Firebase is initialized
 */
function initGroupsService() {
  if (!window.firebaseAuth) {
    console.error('Groups Service: Firebase Auth not initialized');
    return false;
  }
  console.log('Groups Service initialized');
  return true;
}

/**
 * Call a Firebase callable function using the modular SDK
 * @param {string} name - Function name
 * @param {Object} data - Data to send
 * @returns {Promise<Object>} Function result
 */
async function callFunction(name, data = {}) {
  // Check if Firebase Functions is available
  if (!window.firebaseFunctions) {
    throw new Error('Firebase Functions not available (window.firebaseFunctions is not set)');
  }

  try {
    // Dynamically import httpsCallable from the modular SDK
    const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
    const callable = httpsCallable(window.firebaseFunctions, name);
    const result = await callable(data);
    return result.data;
  } catch (error) {
    console.error(`Groups Service: Error calling ${name}:`, error);
    throw new Error(error.message || `Failed to call ${name}`);
  }
}

/**
 * Create a new group (requires MapTap+ subscription)
 * @param {string} groupName - Name for the group (3-30 chars)
 * @returns {Promise<{groupId: string, slug: string, inviteCode: string}>}
 */
async function createGroup(groupName) {
  return await callFunction('createGroup', { groupName });
}

/**
 * Join a group via invite code
 * @param {string} inviteCode - 8-character invite code
 * @returns {Promise<{groupId: string, groupName: string, slug: string}>}
 */
async function joinGroup(inviteCode) {
  return await callFunction('joinGroup', { inviteCode });
}

/**
 * Leave a group
 * @param {string} groupId - Group ID to leave
 * @returns {Promise<{success: boolean}>}
 */
async function leaveGroup(groupId) {
  return await callFunction('leaveGroup', { groupId });
}

/**
 * Kick a member from a group (leader only)
 * @param {string} groupId - Group ID
 * @param {string} memberIdToKick - User ID to remove
 * @returns {Promise<{success: boolean}>}
 */
async function kickMember(groupId, memberIdToKick) {
  return await callFunction('kickGroupMember', { groupId, memberIdToKick });
}

/**
 * Delete a group (leader only)
 * @param {string} groupId - Group ID to delete
 * @returns {Promise<{success: boolean}>}
 */
async function deleteGroup(groupId) {
  return await callFunction('deleteGroup', { groupId });
}

/**
 * Regenerate invite code (leader only)
 * @param {string} groupId - Group ID
 * @returns {Promise<{inviteCode: string}>}
 */
async function regenerateInvite(groupId) {
  return await callFunction('regenerateGroupInvite', { groupId });
}

/**
 * Rename a group (leader only)
 * @param {string} groupId - Group ID
 * @param {string} newName - New group name (2-30 chars)
 * @returns {Promise<{success: boolean, name: string}>}
 */
async function renameGroup(groupId, newName) {
  return await callFunction('renameGroup', { groupId, newName });
}

/**
 * Backfill a member's historical game data (leader only)
 * @param {string} groupId - Group ID
 * @param {string} memberId - Member user ID to backfill
 * @returns {Promise<{success: boolean, datesBackfilled: number}>}
 */
async function backfillMemberData(groupId, memberId) {
  return await callFunction('backfillMemberData', { groupId, memberId });
}

/**
 * Set group visibility (public/private) and description (leader only)
 * @param {string} groupId - Group ID
 * @param {boolean} isPublic - Whether group should be public
 * @param {string} description - Optional description (max 100 chars)
 * @returns {Promise<{success: boolean, isPublic: boolean, description: string}>}
 */
async function setGroupVisibility(groupId, isPublic, description = '') {
  return await callFunction('setGroupVisibility', { groupId, isPublic, description });
}

/**
 * Get list of public groups available to join
 * Public groups are: public, not frozen, active in last 7 days, < 20 members
 * @returns {Promise<Array>} List of public groups
 */
async function getPublicGroups() {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/getPublicGroups`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get public groups');
  }

  return await response.json();
}

/**
 * Join a public group directly (no invite code needed)
 * @param {string} groupId - Group ID to join
 * @returns {Promise<{groupId: string, groupName: string, slug: string}>}
 */
async function joinPublicGroup(groupId) {
  return await callFunction('joinPublicGroup', { groupId });
}

/**
 * Unban a member from a group (leader only)
 * @param {string} groupId - Group ID
 * @param {string} memberIdToUnban - User ID to unban
 * @returns {Promise<{success: boolean}>}
 */
async function unbanMember(groupId, memberIdToUnban) {
  return await callFunction('unbanGroupMember', { groupId, memberIdToUnban });
}

/**
 * Add a comment to a group's activity feed
 * @param {string} groupId - Group ID
 * @param {string} text - Comment text (max 140 chars)
 * @returns {Promise<{commentId: string, comment: Object}>}
 */
async function addComment(groupId, text) {
  const clientDate = getClientDateKey(); // Use client's local date for timezone consistency
  return await callFunction('addGroupComment', { groupId, text, clientDate });
}

/**
 * Delete a comment from a group (leader or author only)
 * @param {string} groupId - Group ID
 * @param {string} commentId - Comment ID to delete
 * @returns {Promise<{success: boolean}>}
 */
async function deleteComment(groupId, commentId) {
  return await callFunction('deleteGroupComment', { groupId, commentId });
}

/**
 * Get unread comment count across all user's groups
 * @returns {Promise<{totalUnread: number, groups: Array}>}
 */
async function getUnreadGroupComments() {
  return await callFunction('getUnreadGroupComments', {});
}

/**
 * Mark a group as read (update last visit timestamp)
 * @param {string} groupId - Group ID
 * @returns {Promise<{success: boolean}>}
 */
async function markGroupAsRead(groupId) {
  return await callFunction('markGroupAsRead', { groupId });
}

/**
 * Sync a score to all groups the user belongs to
 * Called automatically by the game after saving a score
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {number} score - Final score for the day
 * @returns {Promise<{groupsUpdated: number}>}
 */
async function syncScoreToGroups(date, score) {
  return await callFunction('syncScoreToGroups', { date, score });
}

/**
 * Get the client's current date in YYYY-MM-DD format (local timezone)
 * This matches the date format used by the game for storing scores
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getClientDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get group data including today's scores
 * @param {string} groupIdOrSlug - Group ID or URL slug
 * @param {number} weekOffset - Week offset (0 = current week, -1 = previous week, etc.)
 * @returns {Promise<Object>} Full group data with member scores
 */
async function getGroupData(groupIdOrSlug, weekOffset = 0) {
  // Pass client's local date to ensure timezone-correct "today" display
  const clientDate = getClientDateKey();
  return await callFunction('getGroupData', { groupIdOrSlug, clientDate, weekOffset });
}

/**
 * Get all groups the current user belongs to
 * @returns {Promise<Array>} List of groups with quick stats
 */
async function getMyGroups() {
  return await callFunction('getMyGroups', {});
}

/**
 * Get group preview info from invite code (public, no auth required)
 * @param {string} inviteCode - Invite code
 * @returns {Promise<Object>} Basic group info for preview
 */
async function getGroupByInvite(inviteCode) {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/getGroupByInvite?code=${encodeURIComponent(inviteCode)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get group info');
  }

  return await response.json();
}

/**
 * Set up real-time listener for group scores
 * @param {string} groupId - Group ID to listen to
 * @param {Function} onUpdate - Callback when scores update
 * @returns {Function} Unsubscribe function
 */
function listenToGroupScores(groupId, onUpdate) {
  if (!window.firestore || !window.firestore.db) {
    console.error('Groups Service: Firestore not initialized');
    return () => {};
  }

  const today = getClientDateKey(); // Use local date, not UTC
  const db = window.firestore.db;

  // Import Firestore functions
  const { doc, onSnapshot } = window.firestoreFunctions || {};

  if (!doc || !onSnapshot) {
    console.error('Groups Service: Firestore functions not available');
    return () => {};
  }

  const scoresRef = doc(db, 'groups', groupId, 'scores', today);

  const unsubscribe = onSnapshot(scoresRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      onUpdate(data.scores || {});
    } else {
      onUpdate({});
    }
  }, (error) => {
    console.error('Groups Service: Error listening to scores:', error);
  });

  return unsubscribe;
}

/**
 * Generate full invite URL from invite code
 * @param {string} inviteCode - 8-character invite code
 * @returns {string} Full invite URL
 */
function getInviteUrl(inviteCode) {
  return `https://maptap.gg/join/${inviteCode}`;
}

/**
 * Generate group page URL from slug
 * @param {string} slug - Group URL slug
 * @returns {string} Full group page URL
 */
function getGroupUrl(slug) {
  return `https://maptap.gg/group/${slug}`;
}

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Convert various date formats to a Date object
 * @param {Date|string|Object|number} date - Date in various formats
 * @returns {Date|null} Date object or null if invalid
 */
function toDateObject(date) {
  if (!date) return null;

  // Already a Date object
  if (date instanceof Date) return date;

  // Firestore Timestamp with toDate() method
  if (date.toDate && typeof date.toDate === 'function') {
    return date.toDate();
  }

  // Serialized Firestore Timestamp (from callable functions)
  if (date._seconds !== undefined) {
    return new Date(date._seconds * 1000);
  }
  if (date.seconds !== undefined) {
    return new Date(date.seconds * 1000);
  }

  // String date
  if (typeof date === 'string') {
    return new Date(date);
  }

  // Number (milliseconds timestamp)
  if (typeof date === 'number') {
    return new Date(date);
  }

  return null;
}

/**
 * Format a date for display
 * @param {Date|string|Object} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const d = toDateObject(date);
  if (!d) return '';

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format time ago for display
 * @param {Date|string|Object} date - Date to format
 * @returns {string} "X minutes ago" style string
 */
function formatTimeAgo(date) {
  const d = toDateObject(date);
  if (!d) return '';

  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return formatDate(d);
}

// Export to global scope
window.groupsService = {
  init: initGroupsService,
  createGroup,
  joinGroup,
  joinPublicGroup,
  leaveGroup,
  kickMember,
  unbanMember,
  deleteGroup,
  regenerateInvite,
  renameGroup,
  setGroupVisibility,
  backfillMemberData,
  syncScoreToGroups,
  addComment,
  deleteComment,
  getUnreadGroupComments,
  markGroupAsRead,
  getGroupData,
  getMyGroups,
  getGroupByInvite,
  getPublicGroups,
  listenToGroupScores,
  getInviteUrl,
  getGroupUrl,
  getClientDateKey,
  copyToClipboard,
  formatDate,
  formatTimeAgo
};
