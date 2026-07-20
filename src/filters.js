'use strict';

const {
  QUIET_HOURS_ENABLED,
  QUIET_HOURS_START,
  QUIET_HOURS_END,
  EMOJI_REACTION_CHANCE,
} = require('./config');

// ─── Casual message trigger map ───────────────────────────────────────────────
// Keys are fully lower-cased and stripped of non-alphabetic characters.
const CASUAL_TRIGGERS = Object.freeze({
  // Gratitude
  thanks: '🙏',
  thank: '🙏',
  thankyou: '🙏',
  thnx: '🙏',
  ty: '🙏',
  // Acknowledgements
  ok: '👍',
  okay: '👍',
  k: '👍',
  done: '👍',
  cool: '👍',
  nice: '👍',
  great: '👍',
  // Laughter
  haha: '😂',
  lol: '😂',
  lmao: '😂',
  hahaha: '😂',
  // Affection
  love: '❤️',
  miss: '❤️',
  // Celebration
  congrats: '🎉',
  congratulations: '🎉',
});

// ─── Quiet hours state ────────────────────────────────────────────────────────

/**
 * Set of chatIds that received the one-time quiet-hours notification
 * during the current quiet window. Cleared when quiet hours end.
 * @type {Set<string>}
 */
const quietHoursNotified = new Set();

/**
 * Tracks whether quiet hours were active on the last call so we can detect
 * the transition OUT of quiet hours and reset `quietHoursNotified`.
 * @type {boolean}
 */
let _wasInQuietHours = false;

// ─── Quiet hours ─────────────────────────────────────────────────────────────

/**
 * Returns true if the current local hour falls inside the configured quiet window.
 * Handles overnight ranges (e.g. 23 → 7) correctly.
 *
 * Side-effect: resets `quietHoursNotified` when transitioning out of quiet hours,
 * so that the one-time message fires again the next night.
 *
 * @returns {boolean}
 */
function isQuietHours() {
  if (!QUIET_HOURS_ENABLED) return false;

  const hour = new Date().getHours();
  const inQuiet =
    QUIET_HOURS_START < QUIET_HOURS_END
      ? hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END
      : hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END; // overnight range

  // Transition: quiet hours just ended → reset notification set for next night
  if (_wasInQuietHours && !inQuiet) {
    quietHoursNotified.clear();
  }
  _wasInQuietHours = inQuiet;

  return inQuiet;
}

/**
 * Returns true if the given chatId has already received the quiet-hours message
 * during the current quiet window.
 * @param {string} chatId
 * @returns {boolean}
 */
function hasBeenQuietHoursNotified(chatId) {
  return quietHoursNotified.has(chatId);
}

/**
 * Marks a chatId as having received the quiet-hours notification.
 * @param {string} chatId
 */
function markQuietHoursNotified(chatId) {
  quietHoursNotified.add(chatId);
}

// ─── Emoji reaction ───────────────────────────────────────────────────────────

/**
 * Returns the appropriate emoji if the message is a short, casual phrase,
 * or null if it should receive a full AI reply.
 *
 * Only messages of 1–3 words are considered, to avoid ever skipping real questions.
 *
 * @param {string} text  The raw incoming message text.
 * @returns {string|null}
 */
function getReactionEmoji(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Reject multi-word messages (more than 3 words) immediately
  if (trimmed.split(/\s+/).length > 3) return null;

  // Normalise: lowercase, strip everything except a-z
  const cleaned = trimmed.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return null;

  return CASUAL_TRIGGERS[cleaned] || null;
}

/**
 * Returns true if an emoji reaction should be sent this time,
 * based on the configured probability.
 *
 * @param {string|null} emoji  The emoji returned by getReactionEmoji.
 * @returns {boolean}
 */
function shouldReactWithEmoji(emoji) {
  return emoji !== null && Math.random() < EMOJI_REACTION_CHANCE;
}

// ─── Typing simulation ────────────────────────────────────────────────────────

/**
 * Returns a realistic typing delay in milliseconds, scaling with reply length.
 * Clamped to [800, 6000] ms so it always feels human without being too slow.
 *
 * @param {string} text  The text about to be sent.
 * @returns {number}  Milliseconds to wait before sending.
 */
function typingDelayFor(text) {
  const ms = 50 + text.length * 30;
  return Math.min(Math.max(ms, 800), 6000);
}

/**
 * Awaitable sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  isQuietHours,
  hasBeenQuietHoursNotified,
  markQuietHoursNotified,
  getReactionEmoji,
  shouldReactWithEmoji,
  typingDelayFor,
  sleep,
  // Exported for tests only
  _resetQuietHoursState: () => {
    quietHoursNotified.clear();
    _wasInQuietHours = false;
  },
};
