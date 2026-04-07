/**
 * UI/UX Tests
 * 
 * Tests for:
 * 1. Scrolling fix in match import modal (wheel event handler)
 * 2. Button placement in headers
 * 3. UI module view switching
 */

import assert from 'node:assert/strict';

export async function runTests({ assert }) {
  console.log('\n--- UI/UX Tests ---\n');

  // Test 1: VIEWS configuration
  console.log('Test 1: UI VIEWS configuration');
  
  const UIModule = await import('../public/strategies/js/modules/UI.js');
  const UI = UIModule.UI;
  
  assert.ok(UI.VIEWS, 'VIEWS should be defined');
  assert.ok(Array.isArray(UI.VIEWS), 'VIEWS should be an array');
  assert.strictEqual(UI.VIEWS.length, 5, 'Should have 5 views');
  
  const viewIds = UI.VIEWS.map(v => v.id);
  assert.ok(viewIds.includes('editor'), 'Should include editor');
  assert.ok(viewIds.includes('match'), 'Should include match');
  assert.ok(viewIds.includes('browser'), 'Should include browser');
  assert.ok(viewIds.includes('data'), 'Should include data');
  assert.ok(viewIds.includes('convert'), 'Should include convert');
  console.log('  ✓ VIEWS configuration is correct');

  // Test 2: View hash mapping
  console.log('\nTest 2: View hash mapping');
  
  const editorView = UI.VIEWS.find(v => v.id === 'editor');
  assert.strictEqual(editorView.hash, '', 'Editor hash should be empty');
  
  const matchView = UI.VIEWS.find(v => v.id === 'match');
  assert.strictEqual(matchView.hash, 'm', 'Match hash should be m');
  
  const dataView = UI.VIEWS.find(v => v.id === 'data');
  assert.strictEqual(dataView.hash, 'd', 'Data hash should be d');
  
  const convertView = UI.VIEWS.find(v => v.id === 'convert');
  assert.strictEqual(convertView.hash, 'c', 'Convert hash should be c');
  console.log('  ✓ Hash mapping is correct');

  // Test 3: Button placement verification (check HTML structure)
  console.log('\nTest 3: Button placement in HTML');
  
  const fs = await import('node:fs');
  const html = fs.readFileSync('./public/index.html', 'utf-8');
  
  // Check Editor header has save and export
  const editorHeaderMatch = html.match(/id="view-editor"[\s\S]*?<button[^>]*id="btn-save"[^>]*>/);
  assert.ok(editorHeaderMatch, 'Editor should have save button in header');
  
  // Check Match header has save and export
  const matchHeaderMatch = html.match(/id="view-match"[\s\S]*?<button[^>]*id="btn-match-save"[^>]*>/);
  assert.ok(matchHeaderMatch, 'Match should have save button in header');
  
  // Check Match header has import button
  const matchImportMatch = html.match(/id="view-match"[\s\S]*?<button[^>]*id="btn-match-import"[^>]*>/);
  assert.ok(matchImportMatch, 'Match should have import button in header');
  
  // Check Browser header has export
  const browserHeaderMatch = html.match(/id="view-browser"[\s\S]*?<button[^>]*id="btn-share-library"[^>]*>/);
  assert.ok(browserHeaderMatch, 'Browser should have export button');
  console.log('  ✓ Button placement verified in HTML');

  // Test 4: Check export button is not duplicated in footer
  console.log('\nTest 4: Export button uniqueness');
  
  // Count btn-share-editor - should be exactly 1 (in header now)
  const shareEditorMatches = html.match(/id="btn-share-editor"/g);
  assert.ok(shareEditorMatches, 'Should have btn-share-editor');
  assert.strictEqual(shareEditorMatches.length, 1, 'Should have exactly one share-editor button');
  console.log('  ✓ Export button is not duplicated');

  // Test 5: Check match import modal exists
  console.log('\nTest 5: Match import modal structure');
  
  const importModalMatch = html.match(/id="match-import-modal"[\s\S]*?id="hexo-recent-list"/);
  assert.ok(importModalMatch, 'Import modal should have recent games list');
  
  // Check for hexo-recent-list which is the scrolling container
  const hexoRecentListMatch = html.match(/id="hexo-recent-list"/);
  assert.ok(hexoRecentListMatch, 'Should have hexo-recent-list element');
  console.log('  ✓ Import modal structure correct');

  // Test 6: CSS for scrolling in hexo-game-list
  console.log('\nTest 6: CSS scrolling configuration');
  
  const css = fs.readFileSync('./public/strategies/style.css', 'utf-8');
  
  // Check hexo-game-list has overflow-y: auto
  const gameListCss = css.match(/\.hexo-game-list\s*\{[^}]*\}/);
  assert.ok(gameListCss, 'Should have hexo-game-list CSS');
  assert.ok(gameListCss[0].includes('overflow-y: auto'), 'Should have overflow-y: auto');
  console.log('  ✓ CSS scrolling configured correctly');

  // Test 7: Verify wheel event handler in Match.js
  console.log('\nTest 7: Wheel event handler for scrolling fix');
  
  const matchJs = fs.readFileSync('./public/strategies/js/modules/Match.js', 'utf-8');
  
  // Check that wheel handler has checks for hexo-recent-list
  const wheelHandlerMatch = matchJs.match(/document\.addEventListener\('wheel',\s*e\s*=>\s*\{[\s\S]*?e\.target\.closest\('#hexo-recent-list'\)/);
  assert.ok(wheelHandlerMatch, 'Wheel handler should check for hexo-recent-list');
  
  // Check for match-import-modal check
  const modalCheckMatch = matchJs.match(/document\.getElementById\('match-import-modal'\)\?\.hidden/);
  assert.ok(modalCheckMatch, 'Should check if import modal is hidden');
  console.log('  ✓ Wheel event handler has correct guards');

  // Test 8: Verify winCells sync in _goTo
  console.log('\nTest 8: winCells sync in navigation');
  
  const goToMatch = matchJs.match(/_goTo\(node\)\s*\{[\s\S]*?Match\.winCells\s*=\s*node\.isWin/);
  assert.ok(goToMatch, 'Should sync winCells in _goTo');
  console.log('  ✓ winCells synchronization verified');

  console.log('\n--- UI/UX Tests Complete ---\n');
}
