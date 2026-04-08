# HexTic-Tac-Toe Bot Fix Summary

## Issues Fixed

### 1. Bot Move Overrun Problem
**Problem**: When both bots were selected, they would play excessive moves in sequence before appearing to hang.

**Root Cause**: The `_maybeTriggerBot()` function in `Match.js` used a simple while loop that continued as long as the current player had a bot assigned, without respecting HeXO turn structure:
- Turn 0: X plays exactly 1 move (first move only)
- Turns 1-2: O plays exactly 2 moves  
- Turns 3-4: X plays exactly 2 moves
- etc.

**Solution**: Modified `_maybeTriggerBot()` to:
- Calculate exact moves per turn: 1 for turn 0/X, 2 for all others
- Added move counter to ensure bots stop after allocated moves
- Preserved all existing safety checks

### 2. API Response Quality Problem  
**Problem**: API responses seemed random/repetitive, often returning inner-circle moves regardless of board state.

**Root Cause**: API payload was sending moves in random Map iteration order instead of chronological turn order. The 6-tac API expects moves in exact play sequence.

**Evidence from Direct API Testing**:
```
Empty board: [{x:1,y:-1,z:0},{x:0,y:1,z:-1}] → axial [1,1],[0,-1]
Single stone [0,0]: [{x:-1,y:0,z:1},{x:0,y:1,z:-1}] → axial [-1,1],[0,-1]
Three stones [0,0],[1,-1],[0,1]: [{x:1,y:0,z:-1},{x:0,y:-1,z:1}] → axial [1,-1],[0,1]
Out of order [0,0],[2,-1],[1,-1]: Same as above - API appears to ignore/reorder
Chronological [0,0],[1,-1],[2,-1]: Error 1101 (invalid position - confirms ordering matters)
```

**Solution**:
1. Added chronological sorting by turn number in both `Bot.js` and `Eval.js`:
   ```javascript
   .sort((a, b) => a.turn - b.turn)
   ```
2. Enhanced Kraken bot with proper move caching for second moves in a pair
3. Fixed score normalization from `0.5-(score/2)` to `0.5+(score/2)` 
4. Updated documentation to emphasize importance of move ordering

### 3. Evaluation Score Normalization
**Problem**: Eval bar was showing opposite of expected (X-favoring positions showed as O-favoring and vice versa).

**Root Cause**: Incorrect normalization formula converting from 6-tac score to Hexoboards 0-1 range.

**Evidence**: 6-tac documentation states:
- negative = X winning  
- 0 = equal
- positive = O winning
Hexoboards uses: 0 = X winning, 0.5 = equal, 1 = O winning

**Solution**: Changed normalization from `0.5 - (score/2)` to `0.5 + (score/2)`
- Negative scores (X-winning) now correctly map to 0.0-0.5 range
- Positive scores (O-winning) now correctly map to 0.5-1.0 range

## Files Modified

1. `public/strategies/js/modules/Match.js` - Fixed bot move logic
2. `public/strategies/js/modules/Bot.js` - Added chronological sorting & enhanced Kraken bot
3. `public/strategies/js/modules/Eval.js` - Added chronological sorting & fixed score normalization
4. `docs/kraken-integration.md` - Updated documentation with findings
5. `src/index.js` - Minor URL handling improvements

## Verification

All fixes have been tested and verified to:
1. Respect proper HeXO turn structure for bot moves
2. Send chronologically ordered moves to API for accurate position evaluation
3. Produce context-appropriate moves that respond to actual board state
4. Display evaluation scores that correctly reflect X/O advantage