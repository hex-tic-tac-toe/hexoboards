/**
 * Layout Module Tests
 * Tests for layout constants and calculations
 */

import { Layout } from '../public/strategies/js/modules/Layout.js';

export async function runTests({ assert }) {
  console.log('  Layout Tests');
  console.log('  ------------');

  // Test 1: Constants are defined
  console.log('  Test 1: Layout constants...');
  assert.strictEqual(typeof Layout.HEADER_H, 'number', 'HEADER_H should be a number');
  assert.strictEqual(typeof Layout.TOOLBAR_H, 'number', 'TOOLBAR_H should be a number');
  assert.strictEqual(typeof Layout.FOOTER_H, 'number', 'FOOTER_H should be a number');
  assert.strictEqual(typeof Layout.NOTE_W, 'number', 'NOTE_W should be a number');
  assert.strictEqual(typeof Layout.NOTATION_W, 'number', 'NOTATION_W should be a number');
  assert.strictEqual(typeof Layout.LIB_SIDE_W, 'number', 'LIB_SIDE_W should be a number');
  assert.strictEqual(typeof Layout.MATCH_PLAY_W, 'number', 'MATCH_PLAY_W should be a number');
  assert.strictEqual(typeof Layout.MATCH_NOTE_W, 'number', 'MATCH_NOTE_W should be a number');
  assert.strictEqual(typeof Layout.MATCH_TREE_W, 'number', 'MATCH_TREE_W should be a number');
  console.log('    ✓ All layout constants defined');

  // Test 2: boardW calculation (requires window, so we just check the function exists)
  console.log('  Test 2: boardW function...');
  assert.ok(typeof Layout.boardW === 'function', 'boardW should be a function');
  console.log('    ✓ boardW function exists');

  // Test 3: boardH calculation (requires window, so we just check the function exists)
  console.log('  Test 3: boardH function...');
  assert.ok(typeof Layout.boardH === 'function', 'boardH should be a function');
  console.log('    ✓ boardH function exists');

  // Test 4: Consistent values
  console.log('  Test 4: Consistent values...');
  assert.ok(Layout.HEADER_H > 0, 'HEADER_H should be positive');
  assert.ok(Layout.TOOLBAR_H > 0, 'TOOLBAR_H should be positive');
  assert.ok(Layout.FOOTER_H > 0, 'FOOTER_H should be positive');
  assert.ok(Layout.NOTE_W > 0, 'NOTE_W should be positive');
  assert.ok(Layout.NOTATION_W > 0, 'NOTATION_W should be positive');
  assert.ok(Layout.LIB_SIDE_W > 0, 'LIB_SIDE_W should be positive');
  console.log('    ✓ All values are consistent');

  console.log('');
  console.log('  ✓ All Layout tests passed!');
  console.log('');
}
