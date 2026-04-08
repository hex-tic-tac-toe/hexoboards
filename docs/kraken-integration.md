# Kraken Bot Integration Findings

## API Endpoints

The 6-tac Worker exposes stateless compute endpoints:

- `POST /api/v1/compute/best-move` — Returns move immediately (sync)
- `POST /api/v1/compute/eval` — Returns evaluation immediately (sync)
- `POST /api/v1/compute/best-move/jobs` — Async job (returns jobId)
- `POST /api/v1/compute/eval/jobs` — Async job (returns jobId)
- `GET /api/v1/compute/jobs/:id` — Poll job status

## Request Format

```json
{
  "position": { "turnsJson": "{\"turns\":[...]}" },
  "config": { "botName": "kraken" }
}
```

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

## Known Issues

### 6-tac API Bug (Error 1101)

The 6-tac Worker throws exception (error 1101) on non-empty game states:
- Empty game `{"turns":[]}` → works
- Any move placed `{"turns":[{"stones":[...]}]}` → 500 error

This is a bug in 6-tac's Worker, not in our implementation.

**Workaround:** The bot returns `null` on failure, allowing the user to:
- Retry the move
- Switch to random bot
- Play manually

## Implementation Notes

### Hexoboards → 6-tac Format Conversion

Hexoboards cells map to 6-tac turnsJson:
```javascript
// cells: Map<"q,r", {q, r, state, turn}>
// turnsJson: "{\"turns\":[{\"stones\":[[q,r],[q,r]]},...]}"
```

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

- `public/strategies/js/modules/Bot.js` — Kraken bot with sync API
- `public/strategies/js/modules/Eval.js` — Eval with sync API  
- `src/index.js` — Cloudflare Worker proxy (allows GET for job polling)
- `dev_server.py` — Python dev server proxy (supports GET/POST)