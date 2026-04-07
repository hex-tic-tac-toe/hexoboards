/**
 * WinDetector Module Tests
 * Tests for win detection logic
 */

import { WinDetector } from '../public/strategies/js/modules/WinDetector.js';

export async function runTests({ assert }) {
  console.log('  WinDetector Tests');
  console.log('  -----------------');

  // Helper to create a cell map
  function createCellMap(stones) {
    const cells = new Map();
    for (const { q, r, state } of stones) {
      cells.set(`${q},${r}`, { q, r, state });
    }
    return cells;
  }

  // Test 1: No win (empty board)
  console.log('  Test 1: No win on empty board...');
  const emptyCells = createCellMap([]);
  const noWin = WinDetector.check(0, 0, 1, emptyCells);
  assert.strictEqual(noWin, null, 'Empty board should have no win');
  console.log('    ✓ No win detected on empty board');

  // Test 2: Win on horizontal axis (q-axis)
  console.log('  Test 2: Win on horizontal axis...');
  const horizontalWin = createCellMap([
    { q: 0, r: 0, state: 1 },
    { q: 1, r: 0, state: 1 },
    { q: 2, r: 0, state: 1 },
    { q: 3, r: 0, state: 1 },
    { q: 4, r: 0, state: 1 },
    { q: 5, r: 0, state: 1 },
  ]);
  const win1 = WinDetector.check(5, 0, 1, horizontalWin);
  assert.ok(win1, 'Should detect horizontal win');
  assert.strictEqual(win1.length, 6, 'Win should have 6 cells');
  console.log('    ✓ Horizontal win detected');

  // Test 3: Win on diagonal axis (r-axis)
  console.log('  Test 3: Win on diagonal axis...');
  const diagonalWin = createCellMap([
    { q: 0, r: 0, state: 2 },
    { q: 0, r: 1, state: 2 },
    { q: 0, r: 2, state: 2 },
    { q: 0, r: 3, state: 2 },
    { q: 0, r: 4, state: 2 },
    { q: 0, r: 5, state: 2 },
  ]);
  const win2 = WinDetector.check(0, 5, 2, diagonalWin);
  assert.ok(win2, 'Should detect diagonal win');
  assert.strictEqual(win2.length, 6, 'Win should have 6 cells');
  console.log('    ✓ Diagonal win detected');

  // Test 4: Win on third axis (q+r axis)
  console.log('  Test 4: Win on third axis...');
  const thirdAxisWin = createCellMap([
    { q: 0, r: 0, state: 1 },
    { q: 1, r: -1, state: 1 },
    { q: 2, r: -2, state: 1 },
    { q: 3, r: -3, state: 1 },
    { q: 4, r: -4, state: 1 },
    { q: 5, r: -5, state: 1 },
  ]);
  const win3 = WinDetector.check(5, -5, 1, thirdAxisWin);
  assert.ok(win3, 'Should detect third axis win');
  assert.strictEqual(win3.length, 6, 'Win should have 6 cells');
  console.log('    ✓ Third axis win detected');

  // Test 5: No win with only 5 in a row
  console.log('  Test 5: No win with only 5 in a row...');
  const fiveInRow = createCellMap([
    { q: 0, r: 0, state: 1 },
    { q: 1, r: 0, state: 1 },
    { q: 2, r: 0, state: 1 },
    { q: 3, r: 0, state: 1 },
    { q: 4, r: 0, state: 1 },
  ]);
  const noWin5 = WinDetector.check(4, 0, 1, fiveInRow);
  assert.strictEqual(noWin5, null, '5 in a row should not be a win');
  console.log('    ✓ 5 in a row correctly not detected as win');

  // Test 6: Win with more than 6
  console.log('  Test 6: Win with more than 6 in a row...');
  const sevenInRow = createCellMap([
    { q: 0, r: 0, state: 2 },
    { q: 1, r: 0, state: 2 },
    { q: 2, r: 0, state: 2 },
    { q: 3, r: 0, state: 2 },
    { q: 4, r: 0, state: 2 },
    { q: 5, r: 0, state: 2 },
    { q: 6, r: 0, state: 2 },
  ]);
  const win7 = WinDetector.check(6, 0, 2, sevenInRow);
  assert.ok(win7, 'Should detect win with 7 in a row');
  assert.ok(win7.length >= 6, 'Win should have at least 6 cells');
  console.log('    ✓ 7 in a row win detected');

  // Test 7: Different states don't interfere
  console.log('  Test 7: Different states do not interfere...');
  const mixedStones = createCellMap([
    { q: 0, r: 0, state: 1 },
    { q: 1, r: 0, state: 1 },
    { q: 2, r: 0, state: 1 },
    { q: 3, r: 0, state: 1 },
    { q: 4, r: 0, state: 1 },
    { q: 5, r: 0, state: 1 },
    { q: 6, r: 0, state: 2 }, // Different state
  ]);
  const winX = WinDetector.check(5, 0, 1, mixedStones);
  assert.ok(winX, 'Should detect X win');
  assert.strictEqual(winX.length, 6, 'X win should have exactly 6 cells');

  const noWinO = WinDetector.check(6, 0, 2, mixedStones);
  assert.strictEqual(noWinO, null, 'O should not have a win with just 1 stone');
  console.log('    ✓ Different states handled correctly');

  console.log('');
  console.log('  ✓ All WinDetector tests passed!');
  console.log('');
}
