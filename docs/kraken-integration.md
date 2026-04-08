# Kraken Bot Integration Findings

## API Endpoints

The 6-tac Worker exposes stateless compute endpoints:

- `POST /api/v1/compute/best-move` — Returns move immediately (sync)
- `POST /api/v1/compute/eval` — Returns evaluation immediately (sync)
- `POST /api/v1/compute/best-move/jobs` — Async job (returns jobId)
- `POST /api/v1/compute/eval/jobs` — Async job (returns jobId)
- `GET /api/v1/compute/jobs/:id` — Poll job status

## Request Format (our implementation)

```json
{
  "position": { "turnsJson": "{\"turns\":[{\"stones\":[[q,r],[q,r]]},...]}" },
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

## Current Implementation Behavior

1. **Try sync endpoint first** - `/v1/compute/best-move` and `/v1/compute/eval`
2. **On failure (any error/500)** - Bot returns `null`, eval falls back to 0.5 (equal)
3. **User experience** - Move is cancelled, user can:
   - Retry the move
   - Switch to random bot
   - Play manually

This approach handles the 6-tac API bug gracefully without silent fallbacks to random.

## Known Issues

### 6-tac API Bug (Error 1101) - CRITICAL

The 6-tac Worker throws exception (error 1101) on ANY position with stones:

| turnsJson value | Result |
|----------------|--------|
| `{}` | ✅ works |
| `{"turns":[]}` | ✅ works |
| `{"turns":[{"stones":[...]}]}` | ❌ 500 error |
| `{"turns":[]}` (escaped string) | ❌ 500 error |
| Object with turns array | ❌ 500 error |
| Any non-empty game | ❌ 500 error |

This is a confirmed bug in 6-tac's deployed Worker - our code is correct but their backend crashes.

**Only works:** Starting position (before any moves)

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

- `public/strategies/js/modules/Bot.js` — Kraken bot with sync API, returns null on failure
- `public/strategies/js/modules/Eval.js` — Eval with sync API, falls back to 0.5 on failure  
- `src/index.js` — Cloudflare Worker proxy (allows GET for job status)
- `dev_server.py` — Python dev server proxy (supports GET/POST)
- `docs/kraken-integration.md` — This documentation