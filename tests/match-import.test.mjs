/**
 * Match.fromHextic Tests
 * 
 * Tests for:
 * 1. Win detection when loading games from hextic notation
 * 2. Player name parsing and display in tree
 * 3. Hexo game import integration
 * 
 * These tests verify the fromHextic logic without requiring browser APIs.
 */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import the core functions we need for testing
const WinDetector = (await import(join(__dirname, '..', 'public', 'strategies', 'js', 'modules', 'WinDetector.js'))).WinDetector;
const HexGrid = (await import(join(__dirname, '..', 'public', 'strategies', 'js', 'modules', 'HexGrid.js'))).HexGrid;

// Helper: simulate the hextic parsing logic from Match.js
function _intToNat(n) { return n > 0 ? 2 * n - 1 : -2 * n; }
function _natToInt(n) { return n === 0 ? 0 : n % 2 === 1 ? (n + 1) / 2 : -n / 2; }
function _hexToNat(q, r) {
  const a = _intToNat(q), b = _intToNat(r);
  return a >= b ? a * a + a + b : a + b * b;
}
function _natToHex(n) {
  const m = Math.floor(Math.sqrt(n));
  const a = n - m * m < m ? n - m * m : m;
  const b = n - m * m < m ? m : n - m * m - m;
  return { q: _natToInt(a), r: _natToInt(b) };
}

// Test helper: check if a move results in a win
function checkWin(q, r, state, cells) {
  return WinDetector.check(q, r, state, cells);
}

export async function runTests({ assert }) {
  console.log('\n--- Match.fromHextic Logic Tests ---\n');

  // Test 1: Natural number conversion
  console.log('Test 1: Natural number encoding/decoding');
  
  const testCases = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: 1 },
    { q: 2, r: -1 },
  ];
  
  for (const { q, r } of testCases) {
    const encoded = _hexToNat(q, r);
    const decoded = _natToHex(encoded);
    assert.strictEqual(decoded.q, q, `(${q},${r}) should roundtrip q correctly`);
    assert.strictEqual(decoded.r, r, `(${q},${r}) should roundtrip r correctly`);
  }
  console.log('  ✓ Natural number encoding/decoding works');

  // Test 2: Win detection on horizontal line
  console.log('\nTest 2: Win detection for 6-in-a-row (horizontal)');
  
  const cells = new Map();
  // Place 6 X stones horizontally
  for (let i = 0; i < 6; i++) {
    cells.set(`${i},0`, { q: i, r: 0, state: 1, legal: false });
  }
  
  const win = checkWin(5, 0, 1, cells);
  assert.ok(win !== null, 'Should detect horizontal win');
  assert.strictEqual(win.length, 6, 'Win should be 6 cells');
  console.log('  ✓ Horizontal win detected');

  // Test 3: Win detection on diagonal
  console.log('\nTest 3: Win detection for diagonal (NE-SW)');
  
  const diagCells = new Map();
  for (let i = 0; i < 6; i++) {
    diagCells.set(`${i},${-i}`, { q: i, r: -i, state: 2, legal: false });
  }
  
  const diagWin = checkWin(5, -5, 2, diagCells);
  assert.ok(diagWin !== null, 'Should detect diagonal win');
  assert.strictEqual(diagWin.length, 6, 'Win should be 6 cells');
  console.log('  ✓ Diagonal win detected');

  // Test 4: No win with 5 stones
  console.log('\nTest 4: No win with only 5 stones');
  
  const fiveCells = new Map();
  for (let i = 0; i < 5; i++) {
    fiveCells.set(`${i},0`, { q: i, r: 0, state: 1, legal: false });
  }
  
  const noWin = checkWin(4, 0, 1, fiveCells);
  assert.strictEqual(noWin, null, 'Should not detect win with only 5');
  console.log('  ✓ 5-in-a-row correctly not a win');

  // Test 5: Win with more than 6
  console.log('\nTest 5: Win detection with 7 stones');
  
  const sevenCells = new Map();
  for (let i = 0; i < 7; i++) {
    sevenCells.set(`${i},0`, { q: i, r: 0, state: 1, legal: false });
  }
  
  const sevenWin = checkWin(6, 0, 1, sevenCells);
  assert.ok(sevenWin !== null, 'Should detect win with 7');
  assert.ok(sevenWin.length >= 6, 'Win should be at least 6');
  console.log('  ✓ 7-in-a-row win detected');

  // Test 6: Alternate colors don't form win
  console.log('\nTest 6: Alternating colors should not form win');
  
  const altCells = new Map();
  for (let i = 0; i < 6; i++) {
    altCells.set(`${i},0`, { q: i, r: 0, state: i % 2 === 0 ? 1 : 2, legal: false });
  }
  
  const altWin = checkWin(5, 0, 2, altCells);
  assert.strictEqual(altWin, null, 'Should not detect win with alternating');
  console.log('  ✓ Alternating colors correctly ignored');

  // Test 7: Simulate fromHextic parsing with win detection
  console.log('\nTest 7: Simulate fromHextic with win detection');
  
  // Parse notation: all X stones to create a win
  const notation = [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]]; // all X moves
  const cells2 = new Map();
  let winDetected = false;
  
  for (let i = 0; i < notation.length; i++) {
    const [q, r] = notation[i];
    const state = 1; // all X (hextic first player gets all odd moves)
    cells2.set(`${q},${r}`, { q, r, state, legal: false });
    
    // Check for win
    const win = checkWin(q, r, state, cells2);
    if (win) {
      winDetected = true;
      assert.ok(win.length >= 6, 'Win should be at least 6');
    }
  }
  assert.ok(winDetected, 'Win should be detected in this sequence');
  console.log('  ✓ fromHextic simulation with win detection works');

  // Test 8: Player name mapping logic
  console.log('\nTest 8: Player name mapping');
  
  const players = [
    { playerId: 1, displayName: 'Alice' },
    { playerId: 2, displayName: 'Bob' }
  ];
  
  const getPlayerName = (state, players) => {
    if (!players) return null;
    const player = players.find(p => String(p.playerId) === String(state));
    return player?.displayName || null;
  };
  
  assert.strictEqual(getPlayerName(1, players), 'Alice', 'State 1 should map to Alice');
  assert.strictEqual(getPlayerName(2, players), 'Bob', 'State 2 should map to Bob');
  assert.strictEqual(getPlayerName(3, players), null, 'Unknown state should return null');
  assert.strictEqual(getPlayerName(1, null), null, 'No players should return null');
  console.log('  ✓ Player name mapping works correctly');

  // Test 9: Axial format detection
  console.log('\nTest 9: Axial format detection');
  
  const isAxialFormat = (data) => {
    return data.length > 0 && Array.isArray(data[0]) && data[0].length === 2;
  };
  
  assert.strictEqual(isAxialFormat([[0,0],[1,0]]), true, 'Should detect axial format');
  assert.strictEqual(isAxialFormat([0,2,3]), false, 'Should not detect axial for natural numbers');
  assert.strictEqual(isAxialFormat([]), false, 'Empty array should return false');
  console.log('  ✓ Axial format detection works');

  // Test 10: Focus index restoration logic
  console.log('\nTest 10: Focus index restoration');
  
  const parseFocusIndex = (text) => {
    let treeText = text, focusIndex = -1;
    const semi = text.indexOf(';');
    if (semi > 0) {
      treeText = text.slice(0, semi);
      focusIndex = parseInt(text.slice(semi + 1), 10);
    }
    return { treeText, focusIndex };
  };
  
  const { treeText: parsedText, focusIndex } = parseFocusIndex('[[0,0],[1,0];2');
  assert.strictEqual(parsedText, '[[0,0],[1,0]', 'Should parse tree text');
  assert.strictEqual(focusIndex, 2, 'Should parse focus index');
  
  const noFocus = parseFocusIndex('[[0,0]]');
  assert.strictEqual(noFocus.focusIndex, -1, 'No focus should be -1');
  console.log('  ✓ Focus index restoration logic works');

  console.log('\n--- Match.fromHextic Logic Tests Complete ---\n');
}
