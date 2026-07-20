'use strict';

// ─── Node.js version guard (must run before any imports) ─────────────────────
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 18) {
  process.stderr.write(
    '❌  Node.js 18 or higher is required.\n' +
    `    You are running ${process.version}.\n` +
    '    Download the LTS installer from https://nodejs.org\n',
  );
  process.exit(1);
}

require('dotenv').config();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the trimmed env var value, or exits with an informative error if missing.
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const val = (process.env[name] || '').trim();
  if (!val) {
    process.stderr.write(
      `❌  Missing required environment variable: ${name}\n` +
      '    Copy .env.example to .env and fill in your values.\n',
    );
    process.exit(1);
  }
  return val;
}

/**
 * Parses an integer env var with a default and clamps it to [min, max].
 * @param {string} name
 * @param {number} defaultVal
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function envInt(name, defaultVal, min = -Infinity, max = Infinity) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultVal;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    process.stderr.write(`⚠️  ${name} is not a valid integer ("${raw}"). Using default: ${defaultVal}\n`);
    return defaultVal;
  }
  if (parsed < min || parsed > max) {
    process.stderr.write(
      `⚠️  ${name}=${parsed} is out of range [${min}, ${max}]. Using default: ${defaultVal}\n`,
    );
    return defaultVal;
  }
  return parsed;
}

/**
 * Parses a boolean env var.
 * @param {string} name
 * @param {boolean} defaultVal
 * @returns {boolean}
 */
function envBool(name, defaultVal) {
  const raw = (process.env[name] || '').toLowerCase().trim();
  if (raw === '') return defaultVal;
  return raw === 'true' || raw === '1';
}

// ─── Required values ─────────────────────────────────────────────────────────

const GROQ_API_KEY = requireEnv('GROQ_API_KEY');
if (GROQ_API_KEY.length < 10) {
  process.stderr.write(
    `❌  GROQ_API_KEY looks invalid (too short: ${GROQ_API_KEY.length} chars).\n` +
    '    Check your .env file. Get a key at https://console.groq.com/keys\n',
  );
  process.exit(1);
}

// ─── Notification config (validated together) ─────────────────────────────────

const NOTIFY_ENABLED = envBool('NOTIFY_ENABLED', false);
const NOTIFY_NUMBER = (process.env.NOTIFY_NUMBER || '').trim();

if (NOTIFY_ENABLED) {
  if (!NOTIFY_NUMBER) {
    process.stderr.write(
      '❌  NOTIFY_ENABLED=true but NOTIFY_NUMBER is not set.\n' +
      '    Set NOTIFY_NUMBER to your number with country code, no + or spaces (e.g. 15551234567).\n',
    );
    process.exit(1);
  }
  if (!/^\d{7,15}$/.test(NOTIFY_NUMBER)) {
    process.stderr.write(
      `❌  NOTIFY_NUMBER="${NOTIFY_NUMBER}" looks invalid.\n` +
      '    Use digits only, no + or spaces (e.g. 15551234567).\n',
    );
    process.exit(1);
  }
}

// ─── Emoji reaction chance ────────────────────────────────────────────────────

const _emojiChanceRaw = parseFloat(process.env.EMOJI_REACTION_CHANCE ?? '0.5');
const EMOJI_REACTION_CHANCE = (isNaN(_emojiChanceRaw) || _emojiChanceRaw < 0 || _emojiChanceRaw > 1)
  ? (() => {
    process.stderr.write('⚠️  EMOJI_REACTION_CHANCE must be between 0 and 1. Defaulting to 0.5.\n');
    return 0.5;
  })()
  : _emojiChanceRaw;

// ─── Quiet hours ─────────────────────────────────────────────────────────────

const QUIET_HOURS_START = envInt('QUIET_HOURS_START', 23, 0, 23);
const QUIET_HOURS_END = envInt('QUIET_HOURS_END', 7, 0, 23);

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = Object.freeze({
  // API
  GROQ_API_KEY,
  GROQ_TEXT_MODEL: (process.env.GROQ_TEXT_MODEL || '').trim() || 'llama-3.3-70b-versatile',
  GROQ_VISION_MODEL: (process.env.GROQ_VISION_MODEL || '').trim() || 'meta-llama/llama-4-scout-17b-16e-instruct',
  GROQ_WHISPER_MODEL: (process.env.GROQ_WHISPER_MODEL || '').trim() || 'whisper-large-v3-turbo',

  // AI behaviour
  SYSTEM_PROMPT: (process.env.SYSTEM_PROMPT || '').trim() ||
    'You are a helpful assistant replying to WhatsApp messages. Keep replies short and natural.',
  MAX_CONVERSATION_HISTORY: envInt('MAX_CONVERSATION_HISTORY', 10, 1, 50),
  MAX_MESSAGE_LENGTH: envInt('MAX_MESSAGE_LENGTH', 2000, 100, 10000),

  // Filtering
  ALLOWED_NUMBERS: (process.env.ALLOWED_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean),
  IGNORE_GROUPS: envBool('IGNORE_GROUPS', true),

  // Quiet hours
  QUIET_HOURS_ENABLED: envBool('QUIET_HOURS_ENABLED', false),
  QUIET_HOURS_START,
  QUIET_HOURS_END,
  QUIET_HOURS_MESSAGE: (process.env.QUIET_HOURS_MESSAGE || '').trim(),

  // Notifications
  NOTIFY_ENABLED,
  NOTIFY_NUMBER,

  // Rate limiting
  RATE_LIMIT_MAX: envInt('RATE_LIMIT_MAX', 10, 1, 1000),
  RATE_LIMIT_WINDOW_MS: envInt('RATE_LIMIT_WINDOW_MS', 60000, 1000, 3600000),

  // Personality
  EMOJI_REACTION_CHANCE,

  // Logging
  LOG_LEVEL: (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(process.env.LOG_LEVEL || ''))
    ? process.env.LOG_LEVEL
    : 'info',
});
