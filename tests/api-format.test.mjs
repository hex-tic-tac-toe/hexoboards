/**
 * API Payload Format Tests
 * 
 * Tests different payload formats to find one that returns sensible
 * coordinates and eval values for the 6-tac API.
 * 
 * Usage: node scripts/run-tests.mjs api
 */

const SIXTAC_URL = 'https://6-tac.com/api/v1';

async function testBestMove(payload, description) {
  try {
    const response = await fetch(`${SIXTAC_URL}/compute/best-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const text = await response.text();
    if (!response.ok) {
      return { success: false, error: text, status: response.status };
    }
    
    const data = JSON.parse(text);
    return { success: true, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testEval(payload, description) {
  try {
    const response = await fetch(`${SIXTAC_URL}/compute/eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const text = await response.text();
    if (!response.ok) {
      return { success: false, error: text, status: response.status };
    }
    
    const data = JSON.parse(text);
    return { success: true, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function runTests({ assert }) {
  console.log('\n=== Testing 6-tac API Payload Formats ===\n');
  
  const results = [];
  
  // ========================================
  // KEY FINDING: Turns format with cube objects works!
  // When using {"turns":[{"stones":[{"x":1,"y":0,"z":-1},{"x":2,"y":0,"z":-2}]}]}
  // we got different results than the default stones format
  // ========================================
  
  console.log('TEST: Key Finding - turns with cube objects');
  console.log('-'.repeat(50));
  
  const turnsCubeTests = [
    {
      name: 'empty turns with cube objects',
      payload: {
        position: { turnsJson: JSON.stringify({ turns: [] }) },
        config: { botName: 'kraken' }
      }
    },
    {
      name: 'one turn cube objects',
      payload: {
        position: { turnsJson: JSON.stringify({ turns: [{ stones: [{ x: 1, y: 0, z: -1 }, { x: 2, y: 0, z: -2 }] }] }) },
        config: { botName: 'kraken' }
      }
    },
    {
      name: 'two turns cube objects',
      payload: {
        position: { turnsJson: JSON.stringify({ turns: [{ stones: [{ x: 1, y: 0, z: -1 }, { x: 2, y: 0, z: -2 }] }, { stones: [{ x: -1, y: 0, z: 1 }, { x: -2, y: 0, z: 2 }] }] }) },
        config: { botName: 'kraken' }
      }
    },
  ];
  
  for (const format of turnsCubeTests) {
    const result = await testBestMove(format.payload, format.name);
    console.log(`  ${format.name}:`, result.success ? `OK` : `FAIL`);
    if (result.success) {
      console.log(`    stones: ${JSON.stringify(result.data.stones)}`);
      console.log(`    positionId: ${result.data.positionId?.slice(0, 16)}...`);
    } else {
      console.log(`    error: ${result.error?.slice(0, 100)}`);
    }
    results.push({ test: format.name, ...result });
  }

  // ========================================
  // Compare with old stones format
  // ========================================
  console.log('\nTEST: Old stones format (for comparison)');
  console.log('-'.repeat(50));
  
  const stonesTests = [
    {
      name: 'stones empty array',
      payload: {
        position: { turnsJson: JSON.stringify({ stones: [] }) },
        config: { botName: 'kraken' }
      }
    },
    {
      name: 'stones [[0,0]]',
      payload: {
        position: { turnsJson: JSON.stringify({ stones: [[0, 0]] }) },
        config: { botName: 'kraken' }
      }
    },
    {
      name: 'stones [[1,0],[2,0]]',
      payload: {
        position: { turnsJson: JSON.stringify({ stones: [[1, 0], [2, 0]] }) },
        config: { botName: 'kraken' }
      }
    },
  ];
  
  for (const format of stonesTests) {
    const result = await testBestMove(format.payload, format.name);
    console.log(`  ${format.name}:`, result.success ? `OK` : `FAIL`);
    if (result.success) {
      console.log(`    stones: ${JSON.stringify(result.data.stones)}`);
    }
    results.push({ test: `stones_${format.name}`, ...result });
  }

  // ========================================
  // Eval with turns format
  // ========================================
  console.log('\nTEST: Eval with turns format');
  console.log('-'.repeat(50));
  
  const evalTests = [
    {
      name: 'eval empty turns',
      payload: {
        position: { turnsJson: JSON.stringify({ turns: [] }) },
        config: { botName: 'kraken' }
      }
    },
    {
      name: 'eval one turn',
      payload: {
        position: { turnsJson: JSON.stringify({ turns: [{ stones: [{ x: 1, y: 0, z: -1 }, { x: 2, y: 0, z: -2 }] }] }) },
        config: { botName: 'kraken' }
      }
    },
  ];
  
  for (const format of evalTests) {
    const result = await testEval(format.payload, format.name);
    console.log(`  ${format.name}:`, result.success ? `OK` : `FAIL`);
    if (result.success) {
      console.log(`    score: ${result.data.score}, winProb: ${result.data.winProb}`);
    } else {
      console.log(`    error: ${result.error?.slice(0, 100)}`);
    }
    results.push({ test: `eval_${format.name}`, ...result });
  }

  // ========================================
  // Sensible Results Check
  // ========================================
  console.log('\n=== Sensible Results Check ===');
  
  const meaningfulResults = results.filter(r => r.success && r.data?.stones?.length > 0);
  
  // Group by format type
  const turnsResults = meaningfulResults.filter(r => r.test.includes('turns') || r.test.includes('cube'));
  const stonesResults = meaningfulResults.filter(r => r.test.includes('stones_'));
  
  console.log('\nTurns format results:');
  for (const r of turnsResults) {
    const stone = r.data.stones[0];
    console.log(`  ${r.test}: x=${stone.x}, y=${stone.y}, z=${stone.z}`);
  }
  
  console.log('\nStones format results:');
  for (const r of stonesResults) {
    const stone = r.data.stones[0];
    console.log(`  ${r.test}: x=${stone.x}, y=${stone.y}, z=${stone.z}`);
  }

  // Check if turns format gives different results than stones
  const turnsMoves = turnsResults.map(r => `${r.data.stones[0].x},${r.data.stones[0].z}`);
  const stonesMoves = stonesResults.map(r => `${r.data.stones[0].x},${r.data.stones[0].z}`);
  
  const uniqueTurns = [...new Set(turnsMoves)];
  const uniqueStones = [...new Set(stonesMoves)];
  
  console.log(`\nUnique turns moves: ${uniqueTurns.length} - ${uniqueTurns.join(', ')}`);
  console.log(`Unique stones moves: ${uniqueStones.length} - ${uniqueStones.join(', ')}`);
  
  if (uniqueTurns.length > 1) {
    console.log('\n✓ Turns format IS responsive to position!');
  } else if (uniqueStones.length > 1) {
    console.log('\n⚠ Turns format not responsive, but stones format might be');
  } else {
    console.log('\n❌ Neither format is responsive to position');
  }

  console.log('\n✓ API format tests completed');
}
