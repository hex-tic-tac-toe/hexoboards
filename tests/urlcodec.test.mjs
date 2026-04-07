/**
 * URLCodec Module Tests
 * Tests for URL encoding/decoding of board states
 */

import { URLCodec } from '../public/strategies/js/modules/URLCodec.js';

export async function runTests({ assert }) {
  console.log('  URLCodec Tests');
  console.log('  --------------');

  // Test 1: Encode empty board
  console.log('  Test 1: Encode empty board...');
  const emptyGrid = { s: 5, cells: new Map() };
  // Initialize cells for empty grid
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) <= 4) {
        emptyGrid.cells.set(`${q},${r}`, { q, r, state: 0 });
      }
    }
  }
  
  const emptyEncoded = URLCodec.encode(emptyGrid);
  assert.ok(typeof emptyEncoded === 'string', 'Should return a string');
  console.log(`    Encoded: ${emptyEncoded}`);
  console.log('    ✓ Empty board encoding works');

  // Test 2: Encode board with stones
  console.log('  Test 2: Encode board with stones...');
  const grid = { s: 5, cells: new Map() };
  // Initialize cells
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) <= 4) {
        grid.cells.set(`${q},${r}`, { q, r, state: 0 });
      }
    }
  }
  // Add stones
  grid.cells.get('0,0').state = 1; // X at center
  grid.cells.get('1,0').state = 2; // O at (1,0)
  grid.cells.get('-1,0').state = 1; // X at (-1,0)
  
  const encoded = URLCodec.encode(grid);
  assert.ok(typeof encoded === 'string', 'Should return a string');
  assert.ok(encoded.length > 0, 'Should not be empty');
  console.log(`    Encoded: ${encoded}`);
  console.log('    ✓ Board with stones encoding works');

  // Test 3: Decode
  console.log('  Test 3: Decode board...');
  const decoded = URLCodec.decode(encoded);
  assert.ok(decoded, 'Should decode successfully');
  assert.ok(decoded.cells instanceof Map, 'Decoded should have cells Map');
  assert.strictEqual(decoded.cells.get('0,0').state, 1, 'Center should be X');
  assert.strictEqual(decoded.cells.get('1,0').state, 2, '(1,0) should be O');
  assert.strictEqual(decoded.cells.get('-1,0').state, 1, '(-1,0) should be X');
  console.log('    ✓ Decoding works');

  // Test 4: Roundtrip
  console.log('  Test 4: Encode/decode roundtrip...');
  const original = { s: 5, cells: new Map() };
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) <= 4) {
        original.cells.set(`${q},${r}`, { q, r, state: 0 });
      }
    }
  }
  original.cells.get('0,0').state = 1;
  original.cells.get('1,-1').state = 2;
  original.cells.get('2,-2').state = 1;
  
  const roundtrip = URLCodec.decode(URLCodec.encode(original));
  assert.ok(roundtrip, 'Roundtrip should succeed');
  assert.strictEqual(roundtrip.cells.get('0,0').state, 1, 'Center X should survive roundtrip');
  assert.strictEqual(roundtrip.cells.get('1,-1').state, 2, 'O should survive roundtrip');
  assert.strictEqual(roundtrip.cells.get('2,-2').state, 1, 'X should survive roundtrip');
  console.log('    ✓ Roundtrip works');

  // Test 5: Decode invalid input
  console.log('  Test 5: Decode invalid input...');
  const invalid = URLCodec.decode('invalid!@#$');
  assert.strictEqual(invalid, null, 'Invalid input should return null');
  
  const empty = URLCodec.decode('');
  assert.strictEqual(empty, null, 'Empty input should return null');
  console.log('    ✓ Invalid input handling works');

  // Test 6: encodeFull and decodeFull with labels
  console.log('  Test 6: encodeFull/decodeFull with labels...');
  const gridWithLabels = { s: 5, cells: new Map() };
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) <= 4) {
        gridWithLabels.cells.set(`${q},${r}`, { q, r, state: 0 });
      }
    }
  }
  const labels = [{ q: 0, r: 0, mark: 'a' }, { q: 1, r: 0, mark: '1' }];
  
  const fullEncoded = URLCodec.encodeFull(gridWithLabels, labels);
  assert.ok(typeof fullEncoded === 'string', 'encodeFull should return string');
  assert.ok(fullEncoded.length > 0, 'encodeFull should not be empty');
  
  const fullDecoded = URLCodec.decodeFull(fullEncoded);
  assert.ok(fullDecoded, 'decodeFull should succeed');
  assert.ok(fullDecoded.grid, 'decodeFull should have grid');
  assert.ok(fullDecoded.labels, 'decodeFull should have labels');
  assert.strictEqual(fullDecoded.labels.length, 2, 'Should have 2 labels');
  assert.strictEqual(fullDecoded.labels[0].q, 0, 'First label q should be 0');
  assert.strictEqual(fullDecoded.labels[0].mark, 'a', 'First label mark should be "a"');
  console.log('    ✓ encodeFull/decodeFull with labels works');

  console.log('');
  console.log('  ✓ All URLCodec tests passed!');
  console.log('');
}
