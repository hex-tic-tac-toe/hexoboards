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

  // Test 2: boardW calculation
  console.log('  Test 2: boardW calculation...');
  const width1 = Layout.boardW(false, false);
  assert.ok(typeof width1 === 'number', 'boardW should return a number');
  assert.ok(width1 > 0, 'boardW should be positive');

  const width2 = Layout.boardW(true, false);
  const width3 = Layout.boardW(false, true);
  const width4 = Layout.boardW(true, true);

  assert.ok(width2 < width1, 'boardW with note should be smaller');
  assert.ok(width3 < width1, 'boardW with notation should be smaller');
  assert.ok(width4 < width2 && width4 < width3, 'boardW with both should be smallest');
  console.log('    ✓ boardW calculation works correctly');

  // Test 3: boardH calculation
  console.log('  Test 3: boardH calculation...');
  const height = Layout.boardH();
  assert.ok(typeof height === 'number', 'boardH should return a number');
  assert.ok(height > 0, 'boardH should be positive');
  console.log('    ✓ boardH calculation works');

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
