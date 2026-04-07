/**
 * Doc Module Tests
 * Tests for document structure operations
 */

import { Doc } from '../public/strategies/js/modules/Doc.js';

export async function runTests({ assert }) {
  console.log('  Doc Tests');
  console.log('  --------');

  // Test 1: UID generation
  console.log('  Test 1: UID generation...');
  const uid1 = Doc.uid();
  const uid2 = Doc.uid();
  assert.ok(typeof uid1 === 'string', 'UID should be a string');
  assert.ok(uid1.length > 0, 'UID should not be empty');
  assert.notStrictEqual(uid1, uid2, 'Each UID should be unique');
  assert.match(uid1, /^[a-z0-9]+$/, 'UID should be alphanumeric lowercase');
  console.log('    ✓ UID generation works');

  // Test 2: Section creation
  console.log('  Test 2: Section creation...');
  const section = Doc.section('Test Section');
  assert.ok(section, 'Section should be created');
  assert.strictEqual(section.type, 's', 'Section type should be "s"');
  assert.ok(section.id, 'Section should have an id');
  assert.strictEqual(section.title, 'Test Section', 'Section title should match');
  assert.strictEqual(section.collapsed, false, 'Section should not be collapsed by default');
  assert.ok(Array.isArray(section.children), 'Section should have children array');
  assert.strictEqual(section.children.length, 0, 'Section children should be empty initially');
  console.log('    ✓ Section creation works');

  // Test 3: Text node creation
  console.log('  Test 3: Text node creation...');
  const textNode = Doc.text('Hello world');
  assert.ok(textNode, 'Text node should be created');
  assert.strictEqual(textNode.type, 't', 'Text node type should be "t"');
  assert.ok(textNode.id, 'Text node should have an id');
  assert.strictEqual(textNode.md, 'Hello world', 'Text node markdown should match');
  console.log('    ✓ Text node creation works');

  // Test 4: Position creation
  console.log('  Test 4: Position creation...');
  const labels = [[0, 0, 'a'], [1, 0, 'b']];
  const pos = Doc.pos('board123', 'Position Title', 'Position note', labels, 'htn123');
  assert.ok(pos, 'Position should be created');
  assert.strictEqual(pos.type, 'p', 'Position type should be "p"');
  assert.ok(pos.id, 'Position should have an id');
  assert.strictEqual(pos.board, 'board123', 'Position board should match');
  assert.strictEqual(pos.title, 'Position Title', 'Position title should match');
  assert.strictEqual(pos.note, 'Position note', 'Position note should match');
  assert.deepStrictEqual(pos.labels, labels, 'Position labels should match');
  assert.strictEqual(pos.htn, 'htn123', 'Position HTN should match');
  console.log('    ✓ Position creation works');

  // Test 5: Match creation
  console.log('  Test 5: Match creation...');
  const createdAt = Date.now();
  const match = Doc.match('notation123', 'Match Title', 'Match note', createdAt);
  assert.ok(match, 'Match should be created');
  assert.strictEqual(match.type, 'm', 'Match type should be "m"');
  assert.ok(match.id, 'Match should have an id');
  assert.strictEqual(match.notation, 'notation123', 'Match notation should match');
  assert.strictEqual(match.title, 'Match Title', 'Match title should match');
  assert.strictEqual(match.note, 'Match note', 'Match note should match');
  assert.strictEqual(match.createdAt, createdAt, 'Match createdAt should match');
  assert.ok(match.savedAt >= createdAt, 'Match savedAt should be >= createdAt');
  console.log('    ✓ Match creation works');

  // Test 6: Find operation
  console.log('  Test 6: Find operation...');
  const tree = [
    Doc.section('Section 1'),
    Doc.pos('board1', 'Pos 1'),
    Doc.section('Section 2'),
  ];
  // Add children to first section
  tree[0].children.push(Doc.pos('board2', 'Pos 2'));

  const found1 = Doc.find(tree, tree[0].id);
  assert.ok(found1, 'Should find section by id');
  assert.strictEqual(found1[0], tree[0], 'Found section should match');
  assert.strictEqual(found1[1], tree, 'Found in root tree');
  assert.strictEqual(found1[2], 0, 'Found at index 0');

  const found2 = Doc.find(tree, tree[0].children[0].id);
  assert.ok(found2, 'Should find nested position');
  assert.strictEqual(found2[0], tree[0].children[0], 'Found position should match');

  const notFound = Doc.find(tree, 'nonexistent');
  assert.strictEqual(notFound, null, 'Should return null for non-existent id');
  console.log('    ✓ Find operation works');

  // Test 7: Move operation
  console.log('  Test 7: Move operation...');
  const moveTree = [
    Doc.section('First'),
    Doc.section('Second'),
    Doc.section('Third'),
  ];
  const firstId = moveTree[0].id;
  const secondId = moveTree[1].id;

  Doc.move(moveTree, firstId, secondId, true); // Move first before second
  assert.strictEqual(moveTree[0].id, firstId, 'First should now be at index 0');
  assert.strictEqual(moveTree[1].id, secondId, 'Second should now be at index 1');
  console.log('    ✓ Move operation works');

  // Test 8: Remove operation
  console.log('  Test 8: Remove operation...');
  const removeTree = [
    Doc.section('To Remove'),
    Doc.section('Keep'),
  ];
  const toRemoveId = removeTree[0].id;
  const keepId = removeTree[1].id;

  Doc.remove(removeTree, toRemoveId);
  assert.strictEqual(removeTree.length, 1, 'Tree should have 1 item after removal');
  assert.strictEqual(removeTree[0].id, keepId, 'Remaining item should be the one we kept');
  console.log('    ✓ Remove operation works');

  // Test 9: allPositions
  console.log('  Test 9: allPositions...');
  const posTree = [
    Doc.section('Section'),
    Doc.pos('board1', 'Pos 1'),
    Doc.section('Nested'),
  ];
  posTree[2].children = [Doc.pos('board2', 'Pos 2')];

  const allPos = Doc.allPositions(posTree);
  assert.strictEqual(allPos.length, 2, 'Should find 2 positions');
  assert.ok(allPos.some(p => p.board === 'board1'), 'Should find board1');
  assert.ok(allPos.some(p => p.board === 'board2'), 'Should find board2');
  console.log('    ✓ allPositions works');

  // Test 10: fromV0 migration
  console.log('  Test 10: fromV0 migration...');
  const v0Positions = {
    'board123': {
      t: 'Test Title',
      n: 'Test Note',
      l: [[0, 0, 'a'], [1, 0, 'b']],
      h: 'htn123',
      g: ['group1'],
      tags: ['tag1'],
    },
  };

  const doc = Doc.fromV0(v0Positions);
  assert.ok(Array.isArray(doc), 'Should return an array');
  assert.strictEqual(doc.length, 1, 'Should have 1 group');
  assert.strictEqual(doc[0].type, 's', 'Should be a section');
  assert.strictEqual(doc[0].title, 'group1', 'Section title should match group');
  assert.strictEqual(doc[0].children.length, 1, 'Section should have 1 child');
  assert.strictEqual(doc[0].children[0].type, 'p', 'Child should be a position');
  assert.strictEqual(doc[0].children[0].board, 'board123', 'Board should match');
  console.log('    ✓ fromV0 migration works');

  console.log('');
  console.log('  ✓ All Doc tests passed!');
  console.log('');
}
