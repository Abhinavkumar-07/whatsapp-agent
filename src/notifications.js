'use strict';

const { NOTIFY_NUMBER } = require('./config');
const logger = require('./logger');

/**
 * Forwards a notification about an incoming message (and the bot's reply, if any)
 * to the configured NOTIFY_NUMBER as a WhatsApp message-to-self.
 *
 * Failures are logged but never propagated — notification delivery is best-effort.
 *
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @param {string}      fromNumber   Sender's phone number (digits only).
 * @param {string}      incomingText The original message text (or '[image]', etc.).
 * @param {string|null} aiReply      The AI's reply, or null if no reply was sent.
 * @returns {Promise<void>}
 */
async function forwardNotification(sock, fromNumber, incomingText, aiReply) {
  try {
    const notifyJid = `${NOTIFY_NUMBER}@s.whatsapp.net`;

    let text = `📬 New WhatsApp message\nFrom: ${fromNumber}\nMessage: ${incomingText}`;

    if (aiReply !== null && aiReply !== undefined) {
      text += `\n\n🤖 AI replied: ${aiReply}`;
    } else {
      text += '\n\n🌙 (No AI reply sent — quiet hours active)';
    }

    await sock.sendMessage(notifyJid, { text });
    logger.debug({ from: fromNumber }, 'Notification forwarded');
  } catch (err) {
    logger.error({ err, from: fromNumber }, 'Failed to forward notification');
  }
}

module.exports = { forwardNotification };
