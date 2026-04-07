/**
 * GameImport Tests
 * 
 * Tests for:
 * 1. Player parsing from Hexo game HTML
 * 2. Move extraction from various HTML formats
 * 3. Game ID parsing from URLs
 */

import assert from 'node:assert/strict';

const GameImportModule = await import('../public/strategies/js/modules/GameImport.js');
const GameImport = GameImportModule.GameImport;

export async function runTests({ assert }) {
  console.log('\n--- GameImport Tests ---\n');

  // Test 1: Parse game ID from various URL formats
  console.log('Test 1: Parse game ID from URLs');
  
  const uuidUrl = 'https://hexo.did.science/games/880c1fec-1234-5678-abcd-ef0123456789';
  const parsed1 = GameImport.parseGameUrl(uuidUrl);
  assert.strictEqual(parsed1, '880c1fec-1234-5678-abcd-ef0123456789', 'Should parse UUID from URL');
  
  const shortCode = 'abc123';
  const parsed2 = GameImport.parseGameUrl(shortCode);
  assert.strictEqual(parsed2, 'abc123', 'Should parse short code');
  
  // UUID in string without dash handling
  const uuidWithDash = '880c1fec-1234-5678-abcd-ef0123456789';
  const parsed3 = GameImport.parseGameUrl(uuidWithDash);
  assert.strictEqual(parsed3, '880c1fec-1234-5678-abcd-ef0123456789', 'Should parse UUID with dashes');
  
  console.log('  ✓ Game ID parsing works for various formats');

  // Test 2: Parse moves from __NEXT_DATA__ script tag
  console.log('\nTest 2: Parse moves from __NEXT_DATA__');
  
  const nextDataHtml = `
    <html>
    <script id="__NEXT_DATA__" type="application/json">
    {
      "props": {
        "pageProps": {
          "game": {
            "moves": [
              {"q": 0, "r": 0},
              {"q": 1, "r": 0},
              {"q": 0, "r": 1}
            ],
            "players": [
              {"playerId": 1, "displayName": "Alice"},
              {"playerId": 2, "displayName": "Bob"}
            ]
          }
        }
      }
    }
    </script>
    </html>
  `;
  
  const result1 = GameImport.parseMovesFromHtml(nextDataHtml);
  assert.ok(result1.moves, 'Should extract moves');
  assert.strictEqual(result1.moves.length, 3, 'Should have 3 moves');
  assert.strictEqual(result1.moves[0].q, 0, 'First move q should be 0');
  assert.strictEqual(result1.moves[0].r, 0, 'First move r should be 0');
  assert.ok(result1.players, 'Should extract players');
  assert.strictEqual(result1.players.length, 2, 'Should have 2 players');
  assert.strictEqual(result1.players[0].displayName, 'Alice', 'First player should be Alice');
  console.log('  ✓ __NEXT_DATA__ parsing works with players');

  // Test 3: Parse moves with alternative field names
  console.log('\nTest 3: Alternative field name parsing');
  
  const altFieldsHtml = `
    <html>
    <script id="__NEXT_DATA__">
    {
      "props": {
        "pageProps": {
          "game": {
            "moves": [
              {"x": 0, "y": 0},
              {"column": 1, "row": 0}
            ]
          }
        }
      }
    }
    </script>
    </html>
  `;
  
  const result2 = GameImport.parseMovesFromHtml(altFieldsHtml);
  assert.strictEqual(result2.moves.length, 2, 'Should parse moves with x/y');
  assert.strictEqual(result2.moves[0].q, 0, 'Should map x to q');
  assert.strictEqual(result2.moves[1].r, 0, 'Should map row to r');
  console.log('  ✓ Alternative field names handled correctly');

  // Test 4: Parse from history array
  console.log('\nTest 4: Parse from history array');
  
  const historyHtml = `
    <html>
    <script id="__NEXT_DATA__">
    {
      "props": {
        "pageProps": {
          "game": {
            "history": [
              {"q": 0, "r": 0},
              {"q": 1, "r": 0}
            ]
          }
        }
      }
    }
    </script>
    </html>
  `;
  
  const result3 = GameImport.parseMovesFromHtml(historyHtml);
  assert.strictEqual(result3.moves.length, 2, 'Should parse from history');
  console.log('  ✓ History array parsing works');

  // Test 5: Parse from window.__GAME_DATA__
  console.log('\nTest 5: Parse from window.__GAME_DATA__');
  
  const windowDataHtml = `
    <html>
    <script>
      window.__GAME_DATA__ = {
        "moves": [{"q": 5, "r": 5}, {"q": 6, "r": 5}]
      };
    </script>
    </html>
  `;
  
  const result4 = GameImport.parseMovesFromHtml(windowDataHtml);
  assert.strictEqual(result4.moves.length, 2, 'Should parse from window data');
  console.log('  ✓ Window.__GAME_DATA__ parsing works');

  // Test 6: Fallback to regex parsing
  console.log('\nTest 6: Fallback regex parsing');
  
  const regexHtml = `
    <html>
    <body>
      <div>Alice placed at (3, 4)</div>
      <div>Bob placed at (-1, 2)</div>
    </body>
    </html>
  `;
  
  const result5 = GameImport.parseMovesFromHtml(regexHtml);
  assert.ok(result5.moves.length > 0, 'Should fallback to regex');
  console.log('  ✓ Regex fallback works');

  // Test 7: Empty HTML handling
  console.log('\nTest 7: Empty HTML handling');
  
  const emptyResult = GameImport.parseMovesFromHtml('');
  assert.strictEqual(emptyResult.moves.length, 0, 'Should return empty moves');
  assert.strictEqual(emptyResult.players, null, 'Should return null players');
  console.log('  ✓ Empty HTML handled correctly');

  // Test 8: Duration formatting
  console.log('\nTest 8: Duration formatting');
  
  assert.strictEqual(GameImport.formatDuration(0), '-', 'Zero should return dash');
  assert.strictEqual(GameImport.formatDuration(5000), '5s', '5 seconds');
  assert.strictEqual(GameImport.formatDuration(65000), '1:05', '1 minute 5 seconds');
  assert.strictEqual(GameImport.formatDuration(3661000), '61:01', '61 minutes');
  console.log('  ✓ Duration formatting works correctly');

  // Test 9: movesToHextic conversion
  console.log('\nTest 9: movesToHextic conversion');
  
  const moves = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 }
  ];
  const hextic = GameImport.movesToHextic(moves);
  const parsed = JSON.parse(hextic);
  assert.deepStrictEqual(parsed, [[0, 0], [1, 0], [0, 1]], 'Should convert to hextic format');
  console.log('  ✓ movesToHextic works correctly');

  // Test 10: movesToHextic with empty array
  console.log('\nTest 10: movesToHextic with empty/null');
  
  assert.strictEqual(GameImport.movesToHextic([]), '', 'Empty array should return empty string');
  assert.strictEqual(GameImport.movesToHextic(null), '', 'Null should return empty string');
  console.log('  ✓ Empty/null moves handled correctly');

  console.log('\n--- GameImport Tests Complete ---\n');
}
