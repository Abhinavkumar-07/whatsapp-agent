const { test } = require('node:test');
const assert = require('node:assert');

// Basic sanity tests to confirm the test runner + CI pipeline actually work,
// plus a couple of real checks on env-parsing style logic used in the project.

test('emoji reaction chance parses as a number between 0 and 1 by default', () => {
  const chance = parseFloat(process.env.EMOJI_REACTION_CHANCE ?? '0.5');
  assert.strictEqual(typeof chance, 'number');
  assert.ok(chance >= 0 && chance <= 1);
});

test('quiet hours boolean parsing treats "true" (any case) as enabled', () => {
  const parseBool = (val) => (val || 'false').toLowerCase() === 'true';
  assert.strictEqual(parseBool('true'), true);
  assert.strictEqual(parseBool('TRUE'), true);
  assert.strictEqual(parseBool('false'), false);
  assert.strictEqual(parseBool(undefined), false);
});

test('allowed numbers list parses comma-separated env value into a clean array', () => {
  const parseList = (val) =>
    (val || '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

  assert.deepStrictEqual(parseList('919876543210, 911234567890'), [
    '919876543210',
    '911234567890',
  ]);
  assert.deepStrictEqual(parseList(''), []);
});
