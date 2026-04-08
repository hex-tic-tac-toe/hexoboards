/**
 * Shared utilities for 6-tac API communication
 */

// Convert hexoboards cells to six-tac turns format with cube coords
// CRITICAL: Must use turns format with {x,y,z} for API to respond correctly!
// The stones format [[q,r]] ignores position and returns fixed values
// IMPORTANT: Each turn MUST have exactly 2 stones - incomplete turns cause 1101 error
export function cellsToTurnsObject(cells) {
  const cellsArray = Array.from(cells.values())
    .filter(c => c.state !== 0)
    .sort((a, b) => a.turn - b.turn);
  
  // Filter out origin (0,0) - implicitly occupied by player One
  const nonOriginCells = cellsArray.filter(c => !(c.q === 0 && c.r === 0));
  
  // If no stones beyond origin, return empty turns
  if (nonOriginCells.length === 0) {
    return { turns: [] };
  }
  
  const turns = [];
  
  // Group cells into pairs of 2
  for (let i = 0; i < nonOriginCells.length; i += 2) {
    const stone1 = nonOriginCells[i];
    const stone2 = nonOriginCells[i + 1];
    
    const turn = {
      stones: [
        {
          x: stone1.q,
          y: -stone1.q - stone1.r,
          z: stone1.r
        }
      ]
    };
    
    // Add second stone if exists, otherwise pad with origin
    if (stone2) {
      turn.stones.push({
        x: stone2.q,
        y: -stone2.q - stone2.r,
        z: stone2.r
      });
    } else {
      // Pad with origin (0,0) - shouldn't happen in normal play
      turn.stones.push({ x: 0, y: 0, z: 0 });
    }
    
    turns.push(turn);
  }

  return { turns };
}

// Convert cube {x,y,z} to axial {q,r}
export function cubeToAxial(stone) {
  if (Array.isArray(stone)) return { q: stone[0], r: stone[1] };
  return { q: stone.x, r: stone.z };
}

const KRAKEN_URL = '/api/kraken';
const KRAKEN_TIMEOUT_MS = 30000;

/**
 * Call the eval endpoint and return both score and bestMove.
 * This is the single source of truth for Kraken API calls.
 * @param {string} turnsJson - JSON string of turns object
 * @returns {{ score: number|null, bestMove: Array<{q,r}>|null }}
 */
export async function krakenEval(turnsJson) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KRAKEN_TIMEOUT_MS);

    const response = await fetch(`${KRAKEN_URL}/v1/compute/eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position: { turnsJson: turnsJson },
        config: { botName: 'kraken' }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { score: null, bestMove: null };
    }

    const data = await response.json();
    
    // Parse score
    let score = null;
    if (typeof data.winProb === 'number' && Number.isFinite(data.winProb)) {
      score = Math.max(0, Math.min(1, 1 - data.winProb));
    } else if (typeof data.score === 'number' && Number.isFinite(data.score)) {
      score = Math.max(0, Math.min(1, 0.5 + (data.score / 2)));
    }
    
    // Parse bestMove (array of cube coordinates)
    let bestMove = null;
    if (data.bestMove && Array.isArray(data.bestMove) && data.bestMove.length >= 1) {
      bestMove = data.bestMove.map(cubeToAxial);
    }
    
    return { score, bestMove };
  } catch (e) {
    console.warn('Kraken eval failed:', e.message);
    return { score: null, bestMove: null };
  }
}
