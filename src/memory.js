'use strict';

const { MAX_CONVERSATION_HISTORY, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = require('./config');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of distinct chat sessions kept in memory. */
const MAX_CONVERSATIONS = 500;

/** Idle TTL before a conversation is evicted from memory (24 hours). */
const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Conversation store ───────────────────────────────────────────────────────

/** @type {Record<string, Array<{role: string, content: string}>>} */
const conversations = {};

/** @type {Record<string, number>} chatId → last-active timestamp (ms) */
const conversationTimestamps = {};

/**
 * Appends a message to a chat's conversation history and runs eviction.
 * @param {string} chatId
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
function addMessage(chatId, role, content) {
  if (!conversations[chatId]) {
    conversations[chatId] = [];
  }
  conversations[chatId].push({ role, content });
  conversationTimestamps[chatId] = Date.now();
  _evict();
}

/**
 * Returns the last N messages for a chat, where N = MAX_CONVERSATION_HISTORY.
 * Returns an empty array if the chat has no history yet.
 * @param {string} chatId
 * @returns {Array<{role: string, content: string}>}
 */
function getRecentHistory(chatId) {
  return (conversations[chatId] || []).slice(-MAX_CONVERSATION_HISTORY);
}

/**
 * Eviction strategy (runs on every write):
 *  1. Remove conversations idle for longer than CONVERSATION_TTL_MS.
 *  2. If still over MAX_CONVERSATIONS, evict the oldest by timestamp.
 * @private
 */
function _evict() {
  const now = Date.now();

  // Phase 1: TTL eviction
  for (const chatId of Object.keys(conversationTimestamps)) {
    if (now - conversationTimestamps[chatId] > CONVERSATION_TTL_MS) {
      delete conversations[chatId];
      delete conversationTimestamps[chatId];
    }
  }

  // Phase 2: Cap eviction (oldest-first)
  const keys = Object.keys(conversations);
  if (keys.length > MAX_CONVERSATIONS) {
    const overflow = keys.length - MAX_CONVERSATIONS;
    const sorted = keys.sort((a, b) => conversationTimestamps[a] - conversationTimestamps[b]);
    for (let i = 0; i < overflow; i++) {
      delete conversations[sorted[i]];
      delete conversationTimestamps[sorted[i]];
    }
  }
}

/**
 * Returns the number of active conversations (for diagnostics / tests).
 * @returns {number}
 */
function conversationCount() {
  return Object.keys(conversations).length;
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

/** @type {Record<string, {count: number, resetAt: number}>} */
const rateLimits = {};

/**
 * Returns true if the chatId has exceeded the configured rate limit.
 * Counts this call as one message toward the limit.
 * @param {string} chatId
 * @returns {boolean}
 */
function isRateLimited(chatId) {
  const now = Date.now();
  const entry = rateLimits[chatId];

  if (!entry || now > entry.resetAt) {
    // Start a fresh window
    rateLimits[chatId] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

module.exports = {
  addMessage,
  getRecentHistory,
  isRateLimited,
  conversationCount, // exported for tests / diagnostics
};
