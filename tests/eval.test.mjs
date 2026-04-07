/**
 * Eval Module Tests
 * Tests for evaluation functionality
 */

import { Eval } from '../public/strategies/js/modules/Eval.js';

export async function runTests({ assert }) {
  console.log('  Eval Tests');
  console.log('  ----------');

  // Test 1: Evaluate returns a number
  console.log('  Test 1: Evaluate returns a number...');
  const cells = new Map();
  const score = await Eval.evaluate(cells, 0);
  assert.strictEqual(typeof score, 'number', 'Should return a number');
  assert.ok(score >= 0 && score <= 1, 'Score should be between 0 and 1');
  console.log('    ✓ Evaluate returns valid number');

  // Test 2: Render function exists
  console.log('  Test 2: Render function exists...');
  assert.ok(typeof Eval.render === 'function', 'Eval.render should be a function');
  console.log('    ✓ Render function exists');

  // Test 3: Different scores
  console.log('  Test 3: Different scores...');
  const score0 = await Eval.evaluate(cells, 0);
  const score1 = await Eval.evaluate(cells, 1);
  const score2 = await Eval.evaluate(cells, 2);
  
  assert.ok(typeof score0 === 'number', 'Score for turn 0 should be a number');
  assert.ok(typeof score1 === 'number', 'Score for turn 1 should be a number');
  assert.ok(typeof score2 === 'number', 'Score for turn 2 should be a number');
  console.log('    ✓ Different scores handled');

  console.log('');
  console.log('  ✓ All Eval tests passed!');
  console.log('');
}
