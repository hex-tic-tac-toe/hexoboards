/**
 * HexLayout Module Tests
 * Tests for hexagonal layout calculations
 */

import { HexLayout } from '../public/strategies/js/modules/HexLayout.js';

export async function runTests({ assert }) {
  console.log('  HexLayout Tests');
  console.log('  ---------------');

  // Test 1: Fit radius calculation
  console.log('  Test 1: Fit radius calculation...');
  const radius1 = HexLayout.fitRadius(5, 800, 600, 50);
  assert.ok(typeof radius1 === 'number', 'Should return a number');
  assert.ok(radius1 > 0, 'Radius should be positive');
  
  const radius2 = HexLayout.fitRadius(10, 800, 600, 50);
  const radius3 = HexLayout.fitRadius(5, 800, 600, 50);
  assert.ok(radius2 < radius3, 'Larger grid should have smaller radius');
  console.log('    ✓ Fit radius calculation works');

  // Test 2: Hex to pixel conversion
  console.log('  Test 2: Hex to pixel conversion...');
  const pixel = HexLayout.hexToPixel(0, 0, 30);
  assert.ok(typeof pixel === 'object', 'Should return an object');
  assert.ok(typeof pixel.x === 'number', 'Should have x coordinate');
  assert.ok(typeof pixel.y === 'number', 'Should have y coordinate');
  
  // Center should be at (0, 0) in pixel space
  assert.strictEqual(pixel.x, 0, 'Center x should be 0');
  assert.strictEqual(pixel.y, 0, 'Center y should be 0');
  
  // Neighboring cells should be at different positions
  const pixel1 = HexLayout.hexToPixel(1, 0, 30);
  const pixel2 = HexLayout.hexToPixel(0, 1, 30);
  assert.ok(pixel1.x !== pixel2.x || pixel1.y !== pixel2.y, 'Different cells should have different pixel positions');
  console.log('    ✓ Hex to pixel conversion works');

  // Test 3: Center positions
  console.log('  Test 3: Center positions calculation...');
  const positions = HexLayout.centerPositions(3, 30, 100, 100);
  assert.ok(Array.isArray(positions), 'Should return an array');
  assert.strictEqual(positions.length, 3, 'Should have 3 positions');
  
  for (const pos of positions) {
    assert.ok(typeof pos.x === 'number', 'Position should have x');
    assert.ok(typeof pos.y === 'number', 'Position should have y');
  }
  console.log('    ✓ Center positions calculation works');

  // Test 4: Sort function
  console.log('  Test 4: Sort function...');
  const cells = [
    { q: 2, r: 0 },
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  ];
  const sorted = HexLayout.sort(cells);
  assert.ok(Array.isArray(sorted), 'Should return an array');
  assert.strictEqual(sorted[0].q, 0, 'First should be q=0');
  assert.strictEqual(sorted[1].q, 1, 'Second should be q=1');
  assert.strictEqual(sorted[2].q, 2, 'Third should be q=2');
  console.log('    ✓ Sort function works');

  console.log('');
  console.log('  ✓ All HexLayout tests passed!');
  console.log('');
}
