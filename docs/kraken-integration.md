# Kraken Bot Integration - Final Documentation

## Summary

The 6-tac compute API is working correctly with the **turns format using cube coordinates**.

## Key Requirements

1. **Use `turns` format** - NOT `stones` format
2. **Use cube coordinates `{x,y,z}`** - NOT axial `[q,r]`
3. **Complete turns only** - each turn must have exactly 2 stones
4. **Skip origin (0,0)** - center is implicitly occupied by Player One

## Working Payload Format

```json
{
  "position": { "turnsJson": "{\"turns\":[{\"stones\":[{\"x\":1,\"y\":0,\"z\":-1},{\"x\":2,\"y\":0,\"z\":-2}]}]}" },
  "config": { "botName": "kraken" }
}
```

## Hexoboards → 6-tac Conversion

```javascript
function _cellsToTurnsObject(cells) {
  const turns = [];
  const cellsArray = Array.from(cells.values())
    .filter(c => c.state !== 0)
    .sort((a, b) => a.turn - b.turn);
  
  let currentTurn = null;
  let turnIndex = 0;
  
  for (const cell of cellsArray) {
    // Skip origin (0,0) - implicitly occupied by Player One
    if (cell.q === 0 && cell.r === 0) continue;
    
    // Turn mapping: turn0 is implicit, turns1-2 = pair 0, turns3-4 = pair 1
    let targetTurnIndex;
    if (cell.turn <= 0) {
      targetTurnIndex = 0;
    } else {
      targetTurnIndex = Math.floor((cell.turn - 1) / 2);
    }
    
    if (!currentTurn || turnIndex !== targetTurnIndex) {
      currentTurn = { stones: [] };
      turns.push(currentTurn);
      turnIndex = targetTurnIndex;
    }
    
    // Convert axial (q,r) to cube (x,y,z)
    currentTurn.stones.push({
      x: cell.q,
      y: -cell.q - cell.r,
      z: cell.r
    });
  }
  
  return { turns };
}
```

## API Behavior

| Format | Works? | Response |
|--------|--------|----------|
| `{"stones":[]}` | ✓ But ignores position | Fixed inner ring |
| `{"stones":[[q,r]]}` | ✓ But ignores position | Fixed inner ring |
| `{"turns":[]}` | ✓ Works | Position-aware |
| `{"turns":[{"stones":[{x,y,z}, {x,y,z}]}]}` | ✓ Works | Position-aware |
| `{"turns":[{"stones":[{x,y,z}]}]}` (1 stone) | ✗ Error 1101 | Needs 2 stones |

## Verified Working

- ✅ Best-move responds to position (different moves for different boards)
- ✅ Eval responds to position (scores vary: -0.02 → -0.009 → 0.54)
- ✅ Position IDs change for different positions
- ✅ Complete turns (2 stones each) work correctly

## Files Modified

- `public/strategies/js/modules/Bot.js` - Uses turns format with cube coords
- `public/strategies/js/modules/Eval.js` - Uses turns format with cube coords
- `tests/api-format.test.mjs` - Working test cases
- `tests/api-format-extended.test.mjs` - Extended test cases
- `docs/kraken-integration.md` - This documentation
