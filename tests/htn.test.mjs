/**
 * HTN (Hextic Notation) Module Tests
 * Tests for parsing and building HTN notation
 */

import { HTN } from '../public/strategies/js/modules/HTN.js';

export async function runTests({ assert }) {
  console.log('  HTN Tests');
  console.log('  ---------');

  // Test 1: Parse basic notation
  console.log('  Test 1: Parse basic notation...');
  const basic = '1. [0,0][1,0];';
  const parsed1 = HTN.parse(basic);
  assert.ok(parsed1, 'Should parse basic notation');
  assert.ok(Array.isArray(parsed1.turns), 'Should have turns array');
  assert.strictEqual(parsed1.turns.length, 1, 'Should have 1 turn');
  assert.strictEqual(parsed1.turns[0].num, 1, 'Turn number should be 1');
  assert.ok(Array.isArray(parsed1.turns[0].coords), 'Turn should have coords array');
  console.log('    ✓ Basic parsing works');

  // Test 2: Parse multi-turn notation
  console.log('  Test 2: Parse multi-turn notation...');
  const multiTurn = `1. [0,0][1,0];
2. [0,1][1,1];
3. [0,2][1,2];`;
  const parsed2 = HTN.parse(multiTurn);
  assert.strictEqual(parsed2.turns.length, 3, 'Should have 3 turns');
  assert.strictEqual(parsed2.turns[0].num, 1, 'First turn should be 1');
  assert.strictEqual(parsed2.turns[1].num, 2, 'Second turn should be 2');
  assert.strictEqual(parsed2.turns[2].num, 3, 'Third turn should be 3');
  console.log('    ✓ Multi-turn parsing works');

  // Test 3: Parse turn with coords
  console.log('  Test 3: Parse turn with coords...');
  const turnWithCoords = '1. [0,0][1,0];';
  const parsed3 = HTN.parse(turnWithCoords);
  assert.strictEqual(parsed3.turns.length, 1, 'Should have 1 turn');
  assert.ok(Array.isArray(parsed3.turns[0].coords), 'Should have coords array');
  assert.strictEqual(parsed3.turns[0].coords[0].q, 0, 'First coord q should be 0');
  assert.strictEqual(parsed3.turns[0].coords[0].r, 0, 'First coord r should be 0');
  console.log('    ✓ Turn with coords parsing works');

  // Test 4: Build grid from turns
  console.log('  Test 4: Build grid from turns...');
  // Note: HTN format requires center (0,0) to be empty in turns
  // as buildGrid automatically sets it to X (state 1)
  const turns = [
    { num: 1, coords: [{ q: 1, r: 0 }, { q: 2, r: 0 }] },  // Turn 1: O stones
    { num: 2, coords: [{ q: 0, r: 1 }, { q: 1, r: 1 }] },  // Turn 2: X stones
  ];
  const grid = HTN.buildGrid(turns);
  assert.ok(grid, 'Should build grid');
  assert.ok(grid.cells instanceof Map, 'Grid should have cells map');
  // Center is automatically set to X (state 1) by buildGrid
  assert.strictEqual(grid.cells.get('0,0').state, 1, 'Center (0,0) should be X (state 1)');
  // Turn 1 (odd) sets state 2 (O), turn 2 (even) sets state 1 (X)
  assert.strictEqual(grid.cells.get('1,0').state, 2, '(1,0) should be O (state 2) - turn 1');
  assert.strictEqual(grid.cells.get('2,0').state, 2, '(2,0) should be O (state 2) - turn 1');
  assert.strictEqual(grid.cells.get('0,1').state, 1, '(0,1) should be X (state 1) - turn 2');
  assert.strictEqual(grid.cells.get('1,1').state, 1, '(1,1) should be X (state 1) - turn 2');
  console.log('    ✓ Grid building works');

  // Test 5: Parse error handling
  console.log('  Test 5: Parse error handling...');
  // Invalid but structured input throws errors
  assert.throws(() => HTN.parse('1.'), 'Should throw for missing moves');
  assert.throws(() => HTN.parse('1. [0'), 'Should throw for incomplete coordinate');
  // Completely invalid input returns empty result (doesn't throw)
  const invalidResult = HTN.parse('invalid');
  assert.ok(invalidResult, 'Should return result for invalid input');
  assert.ok(Array.isArray(invalidResult.turns), 'Should have turns array');
  console.log('    ✓ Error handling works');

  // Test 6: Complex notation
  console.log('  Test 6: Complex notation with branches...');
  const complex = `1. [0,0][1,0];
2. [0,1][1,1];
3. [0,2][1,2];
4. [0,3][1,3];
5. [0,4][1,4];
6. [0,5][1,5];`;
  const parsedComplex = HTN.parse(complex);
  assert.strictEqual(parsedComplex.turns.length, 6, 'Should have 6 turns');
  
  const gridComplex = HTN.buildGrid(parsedComplex.turns);
  assert.ok(gridComplex.cells.size > 0, 'Should have cells');
  console.log('    ✓ Complex notation works');

  console.log('');
  console.log('  ✓ All HTN tests passed!');
  console.log('');
}
