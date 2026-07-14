require('dotenv').config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
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

// Chance (0-1) of reacting with just an emoji instead of a full text reply, for casual messages
const EMOJI_REACTION_CHANCE = parseFloat(process.env.EMOJI_REACTION_CHANCE ?? '0.5');

// Casual trigger words that are eligible for an emoji-only reaction
const CASUAL_TRIGGERS = {
  thanks: '🙏', thank: '🙏', thankyou: '🙏', thnx: '🙏', ty: '🙏',
  ok: '👍', okay: '👍', k: '👍', done: '👍', cool: '👍', nice: '👍', great: '👍',
  haha: '😂', lol: '😂', lmao: '😂', hahaha: '😂',
  love: '❤️', miss: '❤️',
  congrats: '🎉', congratulations: '🎉',
};

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

// Checks if a message is short/casual enough to qualify for an emoji-only reaction
function getReactionEmoji(text) {
  const cleaned = text.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return null;
  // Only consider short messages (1-3 words) so we never skip real questions
  if (text.trim().split(/\s+/).length > 3) return null;
  return CASUAL_TRIGGERS[cleaned] || null;
}

// Simulates natural typing time based on reply length (feels less instant/robotic)
function typingDelayFor(text) {
  const ms = 500 + text.length * 30;
  return Math.min(Math.max(ms, 800), 6000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transcribeAudio(buffer) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), 'audio.ogg');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Groq transcription error:', JSON.stringify(data));
    return null;
  }
  return data?.text?.trim() || null;
}

async function describeImage(chatId, base64Image, caption) {
  const promptText = caption
    ? `The person sent this image with the caption: "${caption}". Reply naturally as if you just saw the photo, referencing the caption if relevant.`
    : 'The person sent this image. Reply naturally as if you just saw the photo, in a short, casual WhatsApp-style message.';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Groq vision error:', JSON.stringify(data));
    return "Sorry, I couldn't look at that image right now.";
  }

  const reply = data?.choices?.[0]?.message?.content?.trim() || "Nice photo!";

  if (!conversations[chatId]) conversations[chatId] = [];
  conversations[chatId].push({ role: 'user', content: '[sent an image]' });
  conversations[chatId].push({ role: 'assistant', content: reply });

  return reply;
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
      console.log('✅ Connected to WhatsApp! Your AI agent is now live.');
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

      const audioMsg = msg.message.audioMessage;
      const imageMsg = msg.message.imageMessage;

      let text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        imageMsg?.caption ||
        '';

      // --- Voice note: transcribe first, then treat as normal text ---
      if (audioMsg && !text) {
        console.log(`🎤 Voice note from ${senderNumber} — transcribing...`);
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          const transcript = await transcribeAudio(buffer);
          if (!transcript) {
            console.log('⚠️ Could not transcribe voice note.');
            continue;
          }
          console.log(`📝 Transcript: ${transcript}`);
          text = transcript;
        } catch (err) {
          console.error('Error transcribing voice note:', err);
          continue;
        }
      }

      // --- Image: describe + reply directly, skip the normal text flow ---
      if (imageMsg) {
        console.log(`🖼️ Image from ${senderNumber}${text ? ` (caption: ${text})` : ''}`);
        if (isQuietHours()) {
          console.log('🌙 Quiet hours active — skipping image reply.');
          continue;
        }
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          const base64Image = buffer.toString('base64');
          await sock.sendPresenceUpdate('composing', chatId);
          const reply = await describeImage(chatId, base64Image, text);
          await sleep(typingDelayFor(reply));
          await sock.sendMessage(chatId, { text: reply });
          console.log(`🤖 Replied: ${reply}`);

          if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
            await forwardNotification(sock, senderNumber, '[image]', reply);
          }
        } catch (err) {
          console.error('Error handling image:', err);
        }
        continue;
      }

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

      // --- Occasional emoji-only reaction for short/casual messages ---
      const reactionEmoji = getReactionEmoji(text);
      if (reactionEmoji && Math.random() < EMOJI_REACTION_CHANCE) {
        try {
          await sock.sendMessage(chatId, { react: { text: reactionEmoji, key: msg.key } });
          console.log(`👍 Reacted with ${reactionEmoji} instead of a full reply.`);
          if (NOTIFY_ENABLED && NOTIFY_NUMBER) {
            await forwardNotification(sock, senderNumber, text, `(reacted ${reactionEmoji})`);
          }
        } catch (err) {
          console.error('Error sending reaction:', err);
        }
        continue;
      }

      try {
        await sock.sendPresenceUpdate('composing', chatId);
        const reply = await getAIReply(chatId, text);
        await sleep(typingDelayFor(reply));
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