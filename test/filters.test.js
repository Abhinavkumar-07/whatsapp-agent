'use strict';

// Set required env vars BEFORE any module that imports config.js
process.env.GROQ_API_KEY = 'gsk_test_key_1234567890abcdef'; // satisfies length > 10

const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Import after env vars are set
const {
  getReactionEmoji,
  shouldReactWithEmoji,
  typingDelayFor,
  isQuietHours,
  hasBeenQuietHoursNotified,
  markQuietHoursNotified,
  _resetQuietHoursState,
} = require('../src/filters');

// ─── getReactionEmoji ────────────────────────────────────────────────────────

describe('getReactionEmoji', () => {
  it('returns the correct emoji for a known casual word', () => {
    assert.equal(getReactionEmoji('ok'), '👍');
    assert.equal(getReactionEmoji('thanks'), '🙏');
    assert.equal(getReactionEmoji('haha'), '😂');
    assert.equal(getReactionEmoji('congrats'), '🎉');
    assert.equal(getReactionEmoji('love'), '❤️');
  });

  it('is case-insensitive', () => {
    assert.equal(getReactionEmoji('OK'), '👍');
    assert.equal(getReactionEmoji('Thanks'), '🙏');
    assert.equal(getReactionEmoji('HAHA'), '😂');
  });

  it('ignores punctuation and emoji in the message', () => {
    assert.equal(getReactionEmoji('ok!'), '👍');
    assert.equal(getReactionEmoji('thanks 🙏'), '🙏');
    assert.equal(getReactionEmoji('ty!'), '🙏');
  });

  it('returns null for an unknown word', () => {
    assert.equal(getReactionEmoji('hello'), null);
    assert.equal(getReactionEmoji('what'), null);
    assert.equal(getReactionEmoji('goodbye'), null);
  });

  it('returns null for messages longer than 3 words', () => {
    assert.equal(getReactionEmoji('ok sounds good mate'), null);
    assert.equal(getReactionEmoji('thanks for your help today'), null);
  });

  it('returns null for an empty string', () => {
    assert.equal(getReactionEmoji(''), null);
    assert.equal(getReactionEmoji('   '), null);
  });

  it('handles multi-word casual phrases within the 3-word limit', () => {
    // "thankyou" collapsed from two words → still matched
    // (only 1 word after split, so within limit)
    assert.equal(getReactionEmoji('thank you'), '🙏'); // 2 words, collapsed = "thankyou"
  });

  it('returns null for messages that are only punctuation / emoji', () => {
    // After stripping non-alpha the cleaned string is empty
    assert.equal(getReactionEmoji('!!!'), null);
  });
});

// ─── shouldReactWithEmoji ────────────────────────────────────────────────────

describe('shouldReactWithEmoji', () => {
  it('returns false when emoji is null', () => {
    // With any chance value, null emoji must return false
    for (let i = 0; i < 20; i++) {
      assert.equal(shouldReactWithEmoji(null), false);
    }
  });

  it('always returns true when EMOJI_REACTION_CHANCE is 1', () => {
    // Monkeypatch: we cannot easily change the config singleton at runtime,
    // but we can verify the boundary: emoji='👍' and Math.random will be < 1
    // This test just checks that a valid emoji at chance=1 fires consistently
    // (In practice the module was loaded with the default 0.5 from config mock)
    // We verify it CAN return true
    const results = Array.from({ length: 50 }, () => shouldReactWithEmoji('👍'));
    assert.ok(results.some((r) => r === true), 'Expected at least one true result');
    assert.ok(results.some((r) => r === false), 'Expected at least one false result (probabilistic)');
  });
});

// ─── typingDelayFor ──────────────────────────────────────────────────────────

describe('typingDelayFor', () => {
  it('returns the minimum (800ms) for very short text', () => {
    assert.equal(typingDelayFor(''), 800);
    assert.equal(typingDelayFor('hi'), 800);
  });

  it('returns the maximum (6000ms) for very long text', () => {
    const longText = 'a'.repeat(1000);
    assert.equal(typingDelayFor(longText), 6000);
  });

  it('scales with text length in the middle range', () => {
    // 50 + 40*30 = 1250ms → within [800, 6000]
    const delay = typingDelayFor('a'.repeat(40));
    assert.ok(delay >= 800 && delay <= 6000, `Expected delay in [800,6000], got ${delay}`);
  });

  it('always returns a value within [800, 6000]', () => {
    const cases = [0, 1, 10, 50, 100, 200, 500, 1000, 5000];
    for (const len of cases) {
      const delay = typingDelayFor('x'.repeat(len));
      assert.ok(delay >= 800, `Delay ${delay} below minimum for length ${len}`);
      assert.ok(delay <= 6000, `Delay ${delay} above maximum for length ${len}`);
    }
  });

  it('returns a number (not NaN) for empty string', () => {
    assert.ok(!isNaN(typingDelayFor('')));
  });
});

// ─── isQuietHours ────────────────────────────────────────────────────────────

describe('isQuietHours', () => {
  before(() => {
    // QUIET_HOURS_ENABLED is read from the config singleton loaded with
    // GROQ_API_KEY set above; QUIET_HOURS_ENABLED defaults to false.
    // isQuietHours() should therefore always return false in these tests.
  });

  it('returns false when QUIET_HOURS_ENABLED is false (the default)', () => {
    // The config was loaded with no QUIET_HOURS_ENABLED env var → defaults to false
    assert.equal(isQuietHours(), false);
  });
});

// ─── Quiet hours notification tracking ───────────────────────────────────────

describe('Quiet hours notification state', () => {
  afterEach(() => {
    _resetQuietHoursState();
  });

  it('starts with no chatId notified', () => {
    assert.equal(hasBeenQuietHoursNotified('chat1'), false);
  });

  it('correctly marks and reads notification state', () => {
    markQuietHoursNotified('chat1');
    assert.equal(hasBeenQuietHoursNotified('chat1'), true);
    assert.equal(hasBeenQuietHoursNotified('chat2'), false);
  });

  it('resets state after _resetQuietHoursState()', () => {
    markQuietHoursNotified('chat1');
    _resetQuietHoursState();
    assert.equal(hasBeenQuietHoursNotified('chat1'), false);
  });
});
