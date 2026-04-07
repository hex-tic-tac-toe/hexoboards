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
  assert.strictEqual(parsed1.turns[0].turn, 1, 'Turn number should be 1');
  assert.ok(Array.isArray(parsed1.turns[0].moves), 'Turn should have moves array');
  assert.strictEqual(parsed1.turns[0].moves.length, 2, 'Should have 2 moves');
  console.log('    ✓ Basic parsing works');

  // Test 2: Parse multi-turn notation
  console.log('  Test 2: Parse multi-turn notation...');
  const multiTurn = `1. [0,0][1,0];
2. [0,1][1,1];
3. [0,2][1,2];`;
  const parsed2 = HTN.parse(multiTurn);
  assert.strictEqual(parsed2.turns.length, 3, 'Should have 3 turns');
  assert.strictEqual(parsed2.turns[0].turn, 1, 'First turn should be 1');
  assert.strictEqual(parsed2.turns[1].turn, 2, 'Second turn should be 2');
  assert.strictEqual(parsed2.turns[2].turn, 3, 'Third turn should be 3');
  console.log('    ✓ Multi-turn parsing works');

  // Test 3: Parse single move per turn
  console.log('  Test 3: Parse single move per turn...');
  const singleMove = '1. [0,0];';
  const parsed3 = HTN.parse(singleMove);
  assert.strictEqual(parsed3.turns.length, 1, 'Should have 1 turn');
  assert.strictEqual(parsed3.turns[0].moves.length, 1, 'Should have 1 move');
  assert.strictEqual(parsed3.turns[0].moves[0].q, 0, 'Move q should be 0');
  assert.strictEqual(parsed3.turns[0].moves[0].r, 0, 'Move r should be 0');
  console.log('    ✓ Single move parsing works');

  // Test 4: Build grid from turns
  console.log('  Test 4: Build grid from turns...');
  const turns = [
    { turn: 1, moves: [{ q: 0, r: 0 }, { q: 1, r: 0 }] },
    { turn: 2, moves: [{ q: 0, r: 1 }, { q: 1, r: 1 }] },
  ];
  const grid = HTN.buildGrid(turns);
  assert.ok(grid, 'Should build grid');
  assert.ok(grid.cells instanceof Map, 'Grid should have cells map');
  assert.strictEqual(grid.cells.get('0,0').state, 1, '(0,0) should be X (state 1)');
  assert.strictEqual(grid.cells.get('1,0').state, 2, '(1,0) should be O (state 2)');
  assert.strictEqual(grid.cells.get('0,1').state, 1, '(0,1) should be X (state 1)');
  assert.strictEqual(grid.cells.get('1,1').state, 2, '(1,1) should be O (state 2)');
  console.log('    ✓ Grid building works');

  // Test 5: Parse error handling
  console.log('  Test 5: Parse error handling...');
  assert.throws(() => HTN.parse('invalid'), /expected\s+\[/i, 'Should throw for invalid input');
  assert.throws(() => HTN.parse('1.'), /expected\s+\[/i, 'Should throw for missing moves');
  assert.throws(() => HTN.parse('1. [0'), /expected\s+,/i, 'Should throw for incomplete coordinate');
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
