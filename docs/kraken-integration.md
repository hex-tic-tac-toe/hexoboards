# Kraken Bot Integration Findings

## API Endpoints

The 6-tac Worker exposes session-agnostic compute primitives:

- `POST /api/v1/compute/best-move` — Returns move immediately (sync)
- `POST /api/v1/compute/eval` — Returns evaluation immediately (sync)
- `POST /api/v1/compute/best-move/jobs` — Async job (returns jobId)
- `POST /api/v1/compute/eval/jobs` — Async job (returns jobId)
- `GET /api/v1/compute/jobs/:id` — Poll job status

## Request Format

```json
{
  "position": { "turnsJson": "{\"stones\":[[q,r],[q,r],...]}" },
  "config": { "botName": "kraken" }
}
```

**Important:** Use `stones` format, NOT `turns` format!

- ✅ `{"stones":[[0,0],[-1,0]]}` - 2 stones (1 move)
- ✅ `{"stones":[[0,0],[-1,0],[1,-1],[0,-1]]}` - 4 stones (2 moves)
- ✅ `{"stones":[]}` - empty
- ❌ `{"turns":[...]}` - FAILS with error 1101

## Response Format

**best-move:**
```json
{
  "stones": [{ "x": 0, "y": 1, "z": -1 }, { "x": -1, "y": 0, "z": 1 }],
  "modelVersion": "kraken_v1",
  "positionId": "..."
}
```

**eval:**
```json
{
  "score": -0.02,
  "winProb": 0.49,
  "bestMove": [{ "x": 0, "y": 1, "z": -1 }, { "x": -1, "y": 0, "z": 1 }],
  "modelVersion": "kraken_v1",
  "positionId": "..."
}
```

## Current Implementation Behavior

1. **Sync endpoint first** - `/v1/compute/best-move` and `/v1/compute/eval`
2. **On failure** - Bot returns `null`, eval falls back to 0.5 (equal)
3. **User experience** - Move is cancelled, user can retry or switch bots

## Implementation Notes

### Hexoboards → 6-tac Format

Convert cells to stones array (sorted by turn):
```javascript
const stones = cellsArray
  .filter(c => c.state !== 0)
  .sort((a, b) => a.turn - b.turn)
  .map(c => [c.q, c.r]);
// Send as: JSON.stringify({ stones })
```

### 6-tac → Hexoboards Coordinate Conversion

6-tac returns cube coordinates `{x, y, z}`:
```javascript
const q = cube.x;
const r = cube.z;
```

### Score Normalization

6-tac: negative = X winning, positive = O winning  
Hexoboards: 0 = X winning, 0.5 = equal, 1 = O winning

Conversion: `0.5 - (score / 2)`

## Files Modified

- `public/strategies/js/modules/Bot.js` — Kraken bot with stones format
- `public/strategies/js/modules/Eval.js` — Eval with stones format
- `src/index.js` — Cloudflare Worker proxy
- `dev_server.py` — Python dev server proxy
- `docs/kraken-integration.md` — This documentation

## Implementation Notes

### Hexoboards → 6-tac Format Conversion

Hexoboards cells map to 6-tac turnsJson:
```javascript
// cells: Map<"q,r", {q, r, state, turn}>
// turnsJson: "{\"turns\":[{\"stones\":[[q,r],[q,r]]},...]}"
```

### Critical Fix: Chronological Ordering
IMPORTANT: Stones must be sent in chronological order by turn number. Without sorting, the API receives moves in a seemingly random order (based on Map iteration), which causes it to evaluate incorrect positions and return seemingly random or repetitive results.

Fixed in Eval.js line 65: `.sort((a, b) => a.turn - b.turn)`

### 6-tac → Hexoboards Coordinate Conversion

6-tac returns cube coordinates `{x, y, z}`:
```javascript
const q = cube.x;
const r = cube.z;
```

### Score Normalization

6-tac returns `score` where:
- negative = X winning
- 0 = equal  
- positive = O winning

Hexoboards eval bar uses 0-1 where:
- 0 = X winning
- 0.5 = equal
- 1 = O winning

Conversion: `0.5 - (score / 2)`

## Files Modified

- `public/strategies/js/modules/Bot.js` — Kraken bot with sync API, returns null on failure
- `public/strategies/js/modules/Eval.js` — Eval with sync API, falls back to 0.5 on failure  
- `src/index.js` — Cloudflare Worker proxy (allows GET for job status)
- `dev_server.py` — Python dev server proxy (supports GET/POST)
- `docs/kraken-integration.md` — This documentation