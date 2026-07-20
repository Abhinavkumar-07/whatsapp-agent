'use strict';

// Set required env vars BEFORE any module that imports config.js
process.env.GROQ_API_KEY = 'gsk_test_key_1234567890abcdef';
process.env.RATE_LIMIT_MAX = '3';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.MAX_CONVERSATION_HISTORY = '4';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Note on module isolation ─────────────────────────────────────────────────
// Node.js caches `require()` results. Since config.js is loaded once per process,
// we need to clear the cache and re-require memory.js to reset its in-memory state
// between test groups. We do this via a helper below.

function freshMemory() {
  // Bust cache for memory.js only (config stays cached — env vars already set)
  delete require.cache[require.resolve('../src/memory.js')];
  return require('../src/memory.js');
}

// ─── Conversation history ─────────────────────────────────────────────────────

describe('Conversation history', () => {
  let memory;

  beforeEach(() => {
    memory = freshMemory();
  });

  it('starts empty for a new chatId', () => {
    const history = memory.getRecentHistory('chat-new');
    assert.deepEqual(history, []);
  });

  it('stores and retrieves messages in order', () => {
    memory.addMessage('chat1', 'user', 'Hello');
    memory.addMessage('chat1', 'assistant', 'Hi there!');

    const history = memory.getRecentHistory('chat1');
    assert.equal(history.length, 2);
    assert.equal(history[0].role, 'user');
    assert.equal(history[0].content, 'Hello');
    assert.equal(history[1].role, 'assistant');
    assert.equal(history[1].content, 'Hi there!');
  });

  it('respects MAX_CONVERSATION_HISTORY (set to 4 in this test)', () => {
    for (let i = 0; i < 10; i++) {
      memory.addMessage('chat2', 'user', `message ${i}`);
    }
    const history = memory.getRecentHistory('chat2');
    // Should have at most 4 (MAX_CONVERSATION_HISTORY)
    assert.ok(
      history.length <= 4,
      `Expected at most 4 messages, got ${history.length}`,
    );
    // The last message should be the most recent
    assert.equal(history[history.length - 1].content, 'message 9');
  });

  it('keeps conversations for different chats separate', () => {
    memory.addMessage('chatA', 'user', 'Message for A');
    memory.addMessage('chatB', 'user', 'Message for B');

    const histA = memory.getRecentHistory('chatA');
    const histB = memory.getRecentHistory('chatB');

    assert.equal(histA[0].content, 'Message for A');
    assert.equal(histB[0].content, 'Message for B');
    assert.equal(histA.length, 1);
    assert.equal(histB.length, 1);
  });

  it('tracks conversationCount correctly', () => {
    memory.addMessage('chatX', 'user', 'hi');
    memory.addMessage('chatY', 'user', 'hello');
    assert.ok(memory.conversationCount() >= 2);
  });
});

// ─── Rate limiter ─────────────────────────────────────────────────────────────

describe('Rate limiter', () => {
  let memory;

  beforeEach(() => {
    memory = freshMemory();
  });

  it('does not rate-limit on the first message', () => {
    assert.equal(memory.isRateLimited('rl-chat1'), false);
  });

  it('rate-limits after RATE_LIMIT_MAX messages in the same window', () => {
    // RATE_LIMIT_MAX is 3 (set via env above)
    assert.equal(memory.isRateLimited('rl-chat2'), false); // 1st
    assert.equal(memory.isRateLimited('rl-chat2'), false); // 2nd
    assert.equal(memory.isRateLimited('rl-chat2'), false); // 3rd
    assert.equal(memory.isRateLimited('rl-chat2'), true);  // 4th — limited
    assert.equal(memory.isRateLimited('rl-chat2'), true);  // 5th — still limited
  });

  it('does not affect other chats', () => {
    // Max out chat A
    memory.isRateLimited('rl-chatA');
    memory.isRateLimited('rl-chatA');
    memory.isRateLimited('rl-chatA');
    memory.isRateLimited('rl-chatA'); // now limited

    // Chat B should still be fresh
    assert.equal(memory.isRateLimited('rl-chatB'), false);
  });
});
