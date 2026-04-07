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

  // Test 2: Axial to pixel conversion
  console.log('  Test 2: Axial to pixel conversion...');
  const pixel = HexLayout.axialToPixel(0, 0, 30);
  assert.ok(typeof pixel === 'object', 'Should return an object');
  assert.ok(typeof pixel.x === 'number', 'Should have x coordinate');
  assert.ok(typeof pixel.y === 'number', 'Should have y coordinate');
  
  // Neighboring cells should be at different positions
  const pixel1 = HexLayout.axialToPixel(1, 0, 30);
  const pixel2 = HexLayout.axialToPixel(0, 1, 30);
  assert.ok(pixel1.x !== pixel2.x || pixel1.y !== pixel2.y, 'Different cells should have different pixel positions');
  console.log('    ✓ Axial to pixel conversion works');

  // Test 3: spiralOrder
  console.log('  Test 3: spiralOrder...');
  const spiral = HexLayout.spiralOrder(3);
  assert.ok(Array.isArray(spiral), 'Should return an array');
  assert.ok(spiral.length > 0, 'Should have cells');
  assert.ok(spiral[0].q !== undefined, 'Cells should have q coordinate');
  assert.ok(spiral[0].r !== undefined, 'Cells should have r coordinate');
  console.log('    ✓ spiralOrder works');

  // Test 4: hexPath
  console.log('  Test 4: hexPath...');
  const path = HexLayout.hexPath(0, 0, 30, 2);
  assert.ok(typeof path === 'string', 'Should return a string');
  assert.ok(path.includes('M'), 'Path should have M (move) command');
  assert.ok(path.includes('L'), 'Path should have L (line) commands');
  assert.ok(path.includes('Z'), 'Path should end with Z (close)');
  console.log('    ✓ hexPath works');

  console.log('');
  console.log('  ✓ All HexLayout tests passed!');
  console.log('');
}
