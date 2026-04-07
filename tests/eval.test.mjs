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

  // Test 2: Render creates elements
  console.log('  Test 2: Render creates elements...');
  // Mock container for Node.js environment
  const container = {
    innerHTML: '',
    append: function(...children) {
      this.children = children;
    },
    children: [],
  };
  
  Eval.render(container, 0.5);
  assert.ok(container.children.length > 0, 'Should append children to container');
  console.log('    ✓ Render creates elements');

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
