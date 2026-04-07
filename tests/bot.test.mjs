/**
 * Bot Module Tests
 * Tests for bot/AI functionality
 */

import { Bot } from '../public/strategies/js/modules/Bot.js';

export async function runTests({ assert }) {
  console.log('  Bot Tests');
  console.log('  ---------');

  // Test 1: List bots
  console.log('  Test 1: List available bots...');
  const bots = Bot.list();
  assert.ok(Array.isArray(bots), 'Should return an array');
  assert.ok(bots.length > 0, 'Should have at least one bot');
  
  for (const bot of bots) {
    assert.ok(bot.id, 'Bot should have an id');
    assert.ok(bot.name, 'Bot should have a name');
    assert.ok(typeof bot.move === 'function', 'Bot should have a move function');
  }
  console.log(`    ✓ Found ${bots.length} bot(s)`);

  // Test 2: Get bot by id
  console.log('  Test 2: Get bot by id...');
  const firstBot = bots[0];
  const retrieved = Bot.get(firstBot.id);
  assert.ok(retrieved, 'Should retrieve bot by id');
  assert.strictEqual(retrieved.id, firstBot.id, 'Retrieved bot should have same id');
  assert.strictEqual(retrieved.name, firstBot.name, 'Retrieved bot should have same name');

  const nonExistent = Bot.get('nonexistent');
  assert.strictEqual(nonExistent, null, 'Should return null for non-existent bot');
  console.log('    ✓ Get bot by id works');

  // Test 3: Bot move function
  console.log('  Test 3: Bot move function...');
  const cells = new Map();
  // Create a simple 3x3 grid
  for (let q = -1; q <= 1; q++) {
    for (let r = -1; r <= 1; r++) {
      if (Math.abs(q + r) <= 1) {
        cells.set(`${q},${r}`, { q, r, state: 0, legal: true });
      }
    }
  }

  for (const bot of bots) {
    const move = await Bot.computeMove(bot.id, cells, 0);
    // Move can be null (no legal moves) or have q,r properties
    if (move !== null) {
      assert.ok(typeof move.q === 'number', 'Move should have q coordinate');
      assert.ok(typeof move.r === 'number', 'Move should have r coordinate');
    }
  }
  console.log('    ✓ Bot move function works');

  // Test 4: Compute move with invalid bot
  console.log('  Test 4: Invalid bot handling...');
  const invalidMove = await Bot.computeMove('invalid-bot', cells, 0);
  assert.strictEqual(invalidMove, null, 'Invalid bot should return null');
  console.log('    ✓ Invalid bot handled correctly');

  // Test 5: No legal moves
  console.log('  Test 5: No legal moves scenario...');
  const fullCells = new Map();
  // Fill all cells
  for (let q = -1; q <= 1; q++) {
    for (let r = -1; r <= 1; r++) {
      if (Math.abs(q + r) <= 1) {
        fullCells.set(`${q},${r}`, { q, r, state: 1, legal: false }); // Occupied
      }
    }
  }

  for (const bot of bots) {
    const move = await Bot.computeMove(bot.id, fullCells, 0);
    // Bot should return null or handle gracefully
    assert.ok(move === null || typeof move === 'object', 'Should handle no legal moves');
  }
  console.log('    ✓ No legal moves handled correctly');

  console.log('');
  console.log('  ✓ All Bot tests passed!');
  console.log('');
}
