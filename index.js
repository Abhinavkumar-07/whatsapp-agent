require('dotenv').config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  'You are a helpful assistant replying to WhatsApp messages. Keep replies short and natural.';
const ALLOWED_NUMBERS = (process.env.ALLOWED_NUMBERS || '')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);
const IGNORE_GROUPS = (process.env.IGNORE_GROUPS || 'true').toLowerCase() === 'true';

const QUIET_HOURS_ENABLED = (process.env.QUIET_HOURS_ENABLED || 'false').toLowerCase() === 'true';
const QUIET_HOURS_START = parseInt(process.env.QUIET_HOURS_START ?? '23', 10);
const QUIET_HOURS_END = parseInt(process.env.QUIET_HOURS_END ?? '7', 10);
const QUIET_HOURS_MESSAGE = process.env.QUIET_HOURS_MESSAGE || '';

const NOTIFY_ENABLED = (process.env.NOTIFY_ENABLED || 'false').toLowerCase() === 'true';
const NOTIFY_NUMBER = process.env.NOTIFY_NUMBER || '';

// Simple in-memory conversation history per chat (resets on restart)
const conversations = {};

// Tracks chats that already received the one-time quiet hours message (resets on restart)
const quietHoursNotified = new Set();

function isQuietHours() {
  if (!QUIET_HOURS_ENABLED) return false;
  const hour = new Date().getHours();
  if (QUIET_HOURS_START < QUIET_HOURS_END) {
    return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
  }
  // Handles overnight ranges, e.g. 23 -> 7
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

async function getAIReply(chatId, userMessage) {
  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: 'user', content: userMessage });

  // Keep only the last 10 messages to control context size
  const history = conversations[chatId].slice(-10);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Groq API error:', JSON.stringify(data));
    return "Sorry, I couldn't generate a reply right now.";
  }

  const reply = data?.choices?.[0]?.message?.content?.trim() || "Sorry, I didn't quite catch that.";

  conversations[chatId].push({ role: 'assistant', content: reply });
  return reply;
}

async function forwardNotification(sock, fromNumber, incomingText, aiReply) {
  try {
    const notifyJid = `${NOTIFY_NUMBER}@s.whatsapp.net`;
    let text = `📬 New WhatsApp message\nFrom: ${fromNumber}\nMessage: ${incomingText}`;
    if (aiReply) {
      text += `\n\n🤖 AI replied: ${aiReply}`;
    } else {
      text += `\n\n🌙 (No AI reply sent — quiet hours)`;
    }
    await sock.sendMessage(notifyJid, { text });
  } catch (err) {
    console.error('Error forwarding notification:', err);
  }
}

async function startAgent() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nScan this QR code with WhatsApp (Linked Devices):\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startAgent();
    } else if (connection === 'open') {
      console.log('✅ Green tick matlab connected behenchod!.');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const chatId = msg.key.remoteJid;
      const isGroup = chatId.endsWith('@g.us');
      if (IGNORE_GROUPS && isGroup) continue;

      const senderNumber = (msg.key.participant || chatId).split('@')[0];
      if (ALLOWED_NUMBERS.length > 0 && !ALLOWED_NUMBERS.includes(senderNumber)) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      if (!text) continue;

      console.log(`📩 Message from ${senderNumber}: ${text}`);

      // Quiet hours: skip AI auto-reply (optionally send a one-time message instead)
      if (isQuietHours()) {
        console.log('🌙 Quiet hours active — skipping AI reply.');
        if (QUIET_HOURS_MESSAGE && !quietHoursNotified.has(chatId)) {
          try {
            await sock.sendMessage(chatId, { text: QUIET_HOURS_MESSAGE });
            quietHoursNotified.add(chatId);
          } catch (err) {
            console.error('Error sending quiet hours message:', err);
          }
        }
        if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
          await forwardNotification(sock, senderNumber, text, null);
        }
        continue;
      }

      try {
        await sock.sendPresenceUpdate('composing', chatId);
        const reply = await getAIReply(chatId, text);
        await sock.sendMessage(chatId, { text: reply });
        console.log(`🤖 Replied: ${reply}`);

        if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
          await forwardNotification(sock, senderNumber, text, reply);
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    }
  });
}

if (!GROQ_API_KEY) {
  console.error('❌ Missing GROQ_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

startAgent();