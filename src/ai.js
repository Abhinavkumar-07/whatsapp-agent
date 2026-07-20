'use strict';

const {
  GROQ_API_KEY,
  SYSTEM_PROMPT,
  GROQ_TEXT_MODEL,
  GROQ_VISION_MODEL,
  GROQ_WHISPER_MODEL,
  MAX_MESSAGE_LENGTH,
} = require('./config');

const { addMessage, getRecentHistory } = require('./memory');
const logger = require('./logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const AUTH_HEADER = { Authorization: `Bearer ${GROQ_API_KEY}` };

// ─── Input sanitization ───────────────────────────────────────────────────────

/**
 * Sanitizes user-provided message text before sending to the AI:
 *  - Removes null bytes (could cause issues in JSON payloads)
 *  - Trims whitespace
 *  - Truncates to MAX_MESSAGE_LENGTH to limit cost and prevent prompt-stuffing
 *
 * @param {string} text
 * @returns {string}
 */
function sanitizeInput(text) {
  return text
    .replace(/\0/g, '')   // strip null bytes
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

// ─── Groq API helpers ─────────────────────────────────────────────────────────

/**
 * Parses a Groq API response, throwing a descriptive error on HTTP failures.
 * @param {Response} response
 * @param {string} context  Human-readable context for the error message.
 * @returns {Promise<any>}
 */
async function parseGroqResponse(response, context) {
  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`${context}: ${response.status} — ${msg}`);
  }
  return data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Transcribes a voice message buffer using Groq's Whisper model.
 *
 * @param {Buffer} buffer  Raw audio buffer (ogg/opus from WhatsApp).
 * @returns {Promise<string|null>}  The transcription text, or null if empty.
 * @throws {Error} On API failure.
 */
async function transcribeAudio(buffer) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), 'audio.ogg');
  form.append('model', GROQ_WHISPER_MODEL);
  form.append('response_format', 'json');

  const response = await fetch(GROQ_AUDIO_URL, {
    method: 'POST',
    headers: AUTH_HEADER,
    body: form,
  });

  const data = await parseGroqResponse(response, 'Groq transcription error');
  return data?.text?.trim() || null;
}

/**
 * Generates a natural-language reply to an image using Groq's vision model.
 * Stores the exchange in conversation history.
 *
 * @param {string} chatId
 * @param {string} base64Image  Base64-encoded JPEG image data.
 * @param {string} [caption]    Optional caption accompanying the image.
 * @returns {Promise<string>}   The AI's reply.
 * @throws {Error} On API failure.
 */
async function describeImage(chatId, base64Image, caption) {
  const promptText = caption
    ? `The person sent this image with the caption: "${sanitizeInput(caption)}". ` +
      'Reply naturally as if you just saw the photo, referencing the caption if relevant.'
    : 'The person sent this image. Reply naturally as if you just saw the photo, ' +
      'in a short, casual WhatsApp-style message.';

  const response = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
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

  const data = await parseGroqResponse(response, 'Groq vision error');
  const reply = data?.choices?.[0]?.message?.content?.trim() || 'Nice photo!';

  // Record in conversation history so follow-up text replies have context
  addMessage(chatId, 'user', '[sent an image]');
  addMessage(chatId, 'assistant', reply);

  logger.debug({ chatId, model: GROQ_VISION_MODEL }, 'Image described');
  return reply;
}

/**
 * Generates an AI text reply for a given chat, maintaining conversation context.
 *
 * @param {string} chatId
 * @param {string} userMessage  The raw incoming message text.
 * @returns {Promise<string>}   The AI's reply.
 * @throws {Error} On API failure.
 */
async function getAIReply(chatId, userMessage) {
  const sanitized = sanitizeInput(userMessage);
  addMessage(chatId, 'user', sanitized);

  const history = getRecentHistory(chatId);

  const response = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    }),
  });

  const data = await parseGroqResponse(response, 'Groq chat error');
  const reply =
    data?.choices?.[0]?.message?.content?.trim() || "Sorry, I didn't quite catch that.";

  addMessage(chatId, 'assistant', reply);
  logger.debug({ chatId, model: GROQ_TEXT_MODEL }, 'AI reply generated');
  return reply;
}

module.exports = { transcribeAudio, describeImage, getAIReply };
