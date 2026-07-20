'use strict';

// ─── Imports ──────────────────────────────────────────────────────────────────

const path = require('path');
const fs = require('fs');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

const {
  ALLOWED_NUMBERS,
  IGNORE_GROUPS,
  NOTIFY_ENABLED,
  NOTIFY_NUMBER,
  QUIET_HOURS_MESSAGE,
} = require('./config');

const logger = require('./logger');
const { transcribeAudio, describeImage, getAIReply } = require('./ai');
const { isRateLimited } = require('./memory');
const {
  isQuietHours,
  hasBeenQuietHoursNotified,
  markQuietHoursNotified,
  getReactionEmoji,
  shouldReactWithEmoji,
  typingDelayFor,
  sleep,
} = require('./filters');
const { forwardNotification } = require('./notifications');

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_FOLDER = path.join(__dirname, '..', 'auth_info');
const GITIGNORE_PATH = path.join(__dirname, '..', '.gitignore');

/** Maximum number of sequential reconnect attempts before giving up. */
const MAX_RECONNECT_ATTEMPTS = 10;

// ─── Startup safety checks ────────────────────────────────────────────────────

/**
 * Warns if auth_info/ is not excluded from git, which would risk committing
 * live WhatsApp session credentials.
 */
function checkGitignoreSafety() {
  try {
    if (!fs.existsSync(GITIGNORE_PATH)) return;
    const content = fs.readFileSync(GITIGNORE_PATH, 'utf8');
    if (!content.includes('auth_info')) {
      logger.warn(
        '⚠️  auth_info/ is NOT listed in your .gitignore! ' +
        'This folder contains your live WhatsApp session credentials. ' +
        'Add "auth_info/" to .gitignore immediately to prevent an accidental commit.',
      );
    }
  } catch (err) {
    logger.debug({ err }, 'Could not check .gitignore');
  }
}

// ─── Connection management ────────────────────────────────────────────────────

/** Tracks how many consecutive reconnect attempts have been made. */
let reconnectAttempts = 0;

/**
 * Initialises the Baileys socket, registers event handlers, and connects.
 * On clean disconnects it schedules a retry with exponential backoff.
 */
async function startAgent() {
  checkGitignoreSafety();

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  logger.info({ waVersion: version.join('.') }, 'Starting WhatsApp connection...');

  const sock = makeWASocket({
    version,
    auth: state,
    // Suppress Baileys' internal logger; we manage our own.
    logger: require('pino')({ level: 'silent' }),
    printQRInTerminal: false,
  });

  // ── Connection lifecycle ──────────────────────────────────────────────────

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('Scan the QR code below with WhatsApp → Settings → Linked Devices → Link a Device:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (isLoggedOut) {
        logger.warn('Logged out of WhatsApp. Delete auth_info/ and restart to re-link.');
        process.exit(0);
      }

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error(
          { attempts: reconnectAttempts },
          'Max reconnect attempts reached. Exiting. Check your network and restart manually.',
        );
        process.exit(1);
      }

      // Exponential backoff: 1s, 2s, 4s, 8s … capped at 30s
      const delayMs = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
      reconnectAttempts++;

      logger.info(
        { attempt: reconnectAttempts, maxAttempts: MAX_RECONNECT_ATTEMPTS, delayMs, statusCode },
        'Connection closed — reconnecting...',
      );

      setTimeout(startAgent, delayMs);
    } else if (connection === 'open') {
      reconnectAttempts = 0; // reset counter on successful connection
      logger.info('✅ Connected to WhatsApp! AI agent is live.');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Message handling ──────────────────────────────────────────────────────

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    // Process messages sequentially to maintain correct conversation ordering.
    for (const msg of messages) {
      // eslint-disable-next-line no-await-in-loop
      await handleMessage(sock, msg).catch((err) => {
        logger.error({ err, msgId: msg.key?.id }, 'Unhandled error in message handler');
      });
    }
  });
}

// ─── Message handler ──────────────────────────────────────────────────────────

/**
 * Processes a single incoming WhatsApp message.
 *
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} msg
 * @returns {Promise<void>}
 */
async function handleMessage(sock, msg) {
  // Ignore echo / system messages
  if (!msg.message || msg.key.fromMe) return;

  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith('@g.us');

  if (IGNORE_GROUPS && isGroup) return;

  const senderNumber = (msg.key.participant || chatId).split('@')[0];

  // Allowlist check
  if (ALLOWED_NUMBERS.length > 0 && !ALLOWED_NUMBERS.includes(senderNumber)) return;

  // Rate limit check (after allowlist so whitelisted behaviour is still rate-limited)
  if (isRateLimited(chatId)) {
    logger.warn({ senderNumber, chatId }, 'Rate limit exceeded — message ignored');
    return;
  }

  const audioMsg = msg.message.audioMessage;
  const imageMsg = msg.message.imageMessage;

  // Extract text; may be overridden below for voice notes
  let text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    imageMsg?.caption ||
    '';

  // ── Voice note ─────────────────────────────────────────────────────────────
  if (audioMsg && !text) {
    logger.info({ senderNumber }, '🎤 Voice note received — transcribing...');
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      const transcript = await transcribeAudio(buffer);
      if (!transcript) {
        logger.warn({ senderNumber }, 'Voice note produced an empty transcript — skipping');
        return;
      }
      logger.info({ senderNumber, transcript }, '📝 Voice note transcribed');
      text = transcript;
    } catch (err) {
      logger.error({ err, senderNumber }, 'Failed to transcribe voice note');
      return;
    }
  }

  // ── Image ─────────────────────────────────────────────────────────────────
  if (imageMsg) {
    logger.info({ senderNumber, hasCaption: Boolean(text) }, '🖼️ Image received');

    if (isQuietHours()) {
      logger.info({ senderNumber }, '🌙 Quiet hours — skipping image reply');
      if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
        await forwardNotification(sock, senderNumber, '[image]', null);
      }
      return;
    }

    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      const base64Image = buffer.toString('base64');

      await sock.sendPresenceUpdate('composing', chatId);
      const reply = await describeImage(chatId, base64Image, text);
      await sleep(typingDelayFor(reply));
      await sock.sendMessage(chatId, { text: reply });

      logger.info({ senderNumber, reply }, '🤖 Replied to image');

      if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
        await forwardNotification(sock, senderNumber, '[image]', reply);
      }
    } catch (err) {
      logger.error({ err, senderNumber }, 'Failed to handle image message');
    }
    return; // always return after image handling
  }

  // No usable text at this point — nothing to do
  if (!text) return;

  logger.info({ senderNumber, text }, '📩 Text message received');

  // ── Quiet hours ───────────────────────────────────────────────────────────
  if (isQuietHours()) {
    logger.info({ senderNumber }, '🌙 Quiet hours — skipping AI reply');

    if (QUIET_HOURS_MESSAGE && !hasBeenQuietHoursNotified(chatId)) {
      try {
        await sock.sendMessage(chatId, { text: QUIET_HOURS_MESSAGE });
        markQuietHoursNotified(chatId);
        logger.debug({ chatId }, 'Quiet hours message sent');
      } catch (err) {
        logger.error({ err, chatId }, 'Failed to send quiet hours message');
      }
    }

    if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
      await forwardNotification(sock, senderNumber, text, null);
    }
    return;
  }

  // ── Emoji-only reaction (casual short messages) ───────────────────────────
  const reactionEmoji = getReactionEmoji(text);
  if (shouldReactWithEmoji(reactionEmoji)) {
    try {
      await sock.sendMessage(chatId, { react: { text: reactionEmoji, key: msg.key } });
      logger.info({ senderNumber, emoji: reactionEmoji }, '👍 Reacted with emoji');

      if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
        await forwardNotification(sock, senderNumber, text, `(reacted ${reactionEmoji})`);
      }
    } catch (err) {
      logger.error({ err, senderNumber }, 'Failed to send emoji reaction');
    }
    return;
  }

  // ── Full AI text reply ────────────────────────────────────────────────────
  try {
    await sock.sendPresenceUpdate('composing', chatId);
    const reply = await getAIReply(chatId, text);
    await sleep(typingDelayFor(reply));
    await sock.sendMessage(chatId, { text: reply });

    logger.info({ senderNumber, reply }, '🤖 AI replied');

    if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
      await forwardNotification(sock, senderNumber, text, reply);
    }
  } catch (err) {
    logger.error({ err, senderNumber }, 'Failed to generate or send AI reply');
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

startAgent().catch((err) => {
  logger.error({ err }, '❌ Fatal startup error');
  process.exit(1);
});
