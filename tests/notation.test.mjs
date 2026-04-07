/**
 * Notation Module Tests
 * Tests for notation format conversions
 */

import { Notation } from '../public/strategies/js/modules/Notation.js';

export async function runTests({ assert }) {
  console.log('  Notation Tests');
  console.log('  --------------');

  // Helper to create a grid
  function createGrid(stones, size = 5) {
    const cells = new Map();
    for (let q = -(size-1); q <= size-1; q++) {
      for (let r = -(size-1); r <= size-1; r++) {
        if (Math.abs(q + r) <= size-1) {
          cells.set(`${q},${r}`, { q, r, state: 0 });
        }
      }
    }
    for (const { q, r, state } of stones) {
      const key = `${q},${r}`;
      if (cells.has(key)) {
        cells.get(key).state = state;
      }
    }
    return { s: size, cells };
  }

  // Test 1: FORMATS registry
  console.log('  Test 1: FORMATS registry...');
  assert.ok(Notation.FORMATS, 'Should have FORMATS registry');
  assert.ok(Notation.FORMATS.bke, 'Should have BKE format');
  assert.ok(Notation.FORMATS.htn, 'Should have HTN format');
  assert.ok(Notation.FORMATS.axial, 'Should have Axial format');
  
  for (const [id, format] of Object.entries(Notation.FORMATS)) {
    assert.ok(format.label, `${id} should have a label`);
    assert.ok(typeof format.encode === 'function', `${id} should have encode function`);
    assert.ok(typeof format.decode === 'function', `${id} should have decode function`);
  }
  console.log('    ✓ FORMATS registry is valid');

  // Test 2: BKE format roundtrip
  console.log('  Test 2: BKE format roundtrip...');
  const grid1 = createGrid([
    { q: 0, r: 0, state: 1 },
    { q: 1, r: 0, state: 2 },
    { q: 2, r: 0, state: 1 },
  ]);
  
  const bkeEncoded = Notation.gridToFmt(grid1, 'bke');
  assert.ok(typeof bkeEncoded === 'string', 'BKE encoding should return string');
  
  const bkeDecoded = Notation.gridFromFmt(bkeEncoded, 'bke');
  assert.ok(bkeDecoded, 'BKE should decode successfully');
  assert.ok(bkeDecoded.cells instanceof Map, 'Decoded should have cells map');
  console.log('    ✓ BKE format roundtrip works');

  // Test 3: HTN format roundtrip
  console.log('  Test 3: HTN format roundtrip...');
  const grid2 = createGrid([
    { q: 0, r: 0, state: 1 },
    { q: 1, r: 0, state: 2 },
    { q: 0, r: 1, state: 1 },
    { q: 1, r: 1, state: 2 },
  ]);
  
  const htnEncoded = Notation.gridToFmt(grid2, 'htn');
  assert.ok(typeof htnEncoded === 'string', 'HTN encoding should return string');
  assert.ok(htnEncoded.length > 0, 'HTN encoding should not be empty');
  
  const htnDecoded = Notation.gridFromFmt(htnEncoded, 'htn');
  assert.ok(htnDecoded, 'HTN should decode successfully');
  console.log('    ✓ HTN format roundtrip works');

  // Test 4: Axial format roundtrip
  console.log('  Test 4: Axial format roundtrip...');
  const axialEncoded = Notation.gridToFmt(grid2, 'axial');
  assert.ok(typeof axialEncoded === 'string', 'Axial encoding should return string');
  
  const axialDecoded = Notation.gridFromFmt(axialEncoded, 'axial');
  assert.ok(axialDecoded, 'Axial should decode successfully');
  console.log('    ✓ Axial format roundtrip works');

  // Test 5: Invalid format handling
  console.log('  Test 5: Invalid format handling...');
  const invalidEncode = Notation.gridToFmt(grid2, 'invalid');
  assert.strictEqual(invalidEncode, '', 'Invalid format encode should return empty string');
  
  const invalidDecode = Notation.gridFromFmt('some text', 'invalid');
  assert.strictEqual(invalidDecode, null, 'Invalid format decode should return null');
  console.log('    ✓ Invalid format handling works');

  // Test 6: parseMulti
  console.log('  Test 6: parseMulti...');
  const multiString = '["notation1", "notation2", "notation3"]';
  const parsed = Notation.parseMulti(multiString);
  assert.ok(Array.isArray(parsed), 'Should return an array');
  assert.strictEqual(parsed.length, 3, 'Should have 3 items');
  assert.strictEqual(parsed[0], 'notation1', 'First item should match');
  
  const singleString = 'single notation';
  const parsedSingle = Notation.parseMulti(singleString);
  assert.ok(Array.isArray(parsedSingle), 'Should return an array for single string');
  assert.strictEqual(parsedSingle.length, 1, 'Should have 1 item');
  assert.strictEqual(parsedSingle[0], 'single notation', 'Item should match');
  console.log('    ✓ parseMulti works');

  // Test 7: convertBatch
  console.log('  Test 7: convertBatch...');
  // First encode some grids
  const testGrid = { s: 3, cells: new Map() };
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(q + r) <= 2) {
        testGrid.cells.set(`${q},${r}`, { q, r, state: 0 });
      }
    }
  }
  testGrid.cells.get('0,0').state = 1;
  testGrid.cells.get('1,0').state = 2;
  
  const bkeNotation = Notation.gridToFmt(testGrid, 'bke');
  const entries = [bkeNotation];
  
  const converted = Notation.convertBatch(entries, 'bke', 'axial');
  assert.ok(Array.isArray(converted), 'Should return an array');
  assert.strictEqual(converted.length, 1, 'Should have 1 converted item');
  assert.ok(typeof converted[0] === 'string', 'Converted item should be a string');
  console.log('    ✓ convertBatch works');

  console.log('');
  console.log('  ✓ All Notation tests passed!');
  console.log('');
}
