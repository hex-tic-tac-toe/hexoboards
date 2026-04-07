/**
 * HexGrid Module Tests
 * Tests for the hexagonal grid operations
 */

import { HexGrid } from '../public/strategies/js/modules/HexGrid.js';

export async function runTests({ assert }) {
  console.log('  HexGrid Tests');
  console.log('  -------------');

  // Test 1: Grid creation
  console.log('  Test 1: Grid creation...');
  const grid = HexGrid.create(5);
  assert.strictEqual(grid.s, 5, 'Grid should have size 5');
  assert.ok(grid.cells instanceof Map, 'Grid cells should be a Map');
  // For size 5, we should have cells from rings 0-4
  // Total cells = 1 + 6 + 12 + 18 + 24 = 61
  assert.strictEqual(grid.cells.size, 61, 'Size 5 grid should have 61 cells');
  console.log('    ✓ Grid creation works');

  // Test 2: Cell operations
  console.log('  Test 2: Cell operations...');
  const cell = HexGrid.cell(grid, 0, 0);
  assert.ok(cell, 'Should get center cell');
  assert.strictEqual(cell.q, 0, 'Cell q should be 0');
  assert.strictEqual(cell.r, 0, 'Cell r should be 0');
  assert.strictEqual(cell.state, 0, 'Cell should be empty initially');
  console.log('    ✓ Cell operations work');

  // Test 3: Key generation
  console.log('  Test 3: Key generation...');
  assert.strictEqual(HexGrid.key(0, 0), '0,0', 'Key for (0,0) should be "0,0"');
  assert.strictEqual(HexGrid.key(1, -1), '1,-1', 'Key for (1,-1) should be "1,-1"');
  assert.strictEqual(HexGrid.key(-2, 3), '-2,3', 'Key for (-2,3) should be "-2,3"');
  console.log('    ✓ Key generation works');

  // Test 4: Set state
  console.log('  Test 4: Setting cell state...');
  HexGrid.setState(grid, 0, 0, 1); // Set X
  const updatedCell = HexGrid.cell(grid, 0, 0);
  assert.strictEqual(updatedCell.state, 1, 'Cell should be X (1) after setting');
  
  HexGrid.setState(grid, 1, 0, 2); // Set O
  const oCell = HexGrid.cell(grid, 1, 0);
  assert.strictEqual(oCell.state, 2, 'Cell should be O (2) after setting');
  console.log('    ✓ Setting cell state works');

  // Test 5: Count stones
  console.log('  Test 5: Counting stones...');
  const counts = HexGrid.countStones(grid);
  assert.strictEqual(counts.x, 1, 'Should have 1 X stone');
  assert.strictEqual(counts.o, 1, 'Should have 1 O stone');
  assert.strictEqual(counts.total, 2, 'Should have 2 total stones');
  console.log('    ✓ Counting stones works');

  // Test 6: fromCellMap
  console.log('  Test 6: Creating grid from cell map...');
  const cellMap = new Map();
  cellMap.set('0,0', { q: 0, r: 0, state: 1 });
  cellMap.set('1,0', { q: 1, r: 0, state: 2 });
  cellMap.set('2,0', { q: 2, r: 0, state: 1 });
  
  const newGrid = HexGrid.fromCellMap(cellMap);
  assert.ok(newGrid, 'Should create grid from cell map');
  assert.strictEqual(HexGrid.cell(newGrid, 0, 0).state, 1, 'Should have X at (0,0)');
  assert.strictEqual(HexGrid.cell(newGrid, 1, 0).state, 2, 'Should have O at (1,0)');
  assert.strictEqual(HexGrid.cell(newGrid, 2, 0).state, 1, 'Should have X at (2,0)');
  console.log('    ✓ Creating grid from cell map works');

  // Test 7: Edge cases
  console.log('  Test 7: Edge cases...');
  // Setting state on non-existent cell should not throw
  assert.doesNotThrow(() => HexGrid.setState(grid, 100, 100, 1), 'Setting state on non-existent cell should not throw');
  
  // Getting cell outside grid should return null
  const outsideCell = HexGrid.cell(grid, 100, 100);
  assert.strictEqual(outsideCell, null, 'Getting cell outside grid should return null');
  
  // Empty cell map should create minimum size grid
  const emptyGrid = HexGrid.fromCellMap(new Map());
  assert.ok(emptyGrid.s >= 2, 'Empty cell map should create minimum size grid');
  console.log('    ✓ Edge cases handled correctly');

  console.log('');
  console.log('  ✓ All HexGrid tests passed!');
  console.log('');
}
