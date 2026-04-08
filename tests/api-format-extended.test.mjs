/**
 * API Payload Format Tests - Extended
 * 
 * Tests different payload formats to verify correct API behavior
 * NOTE: Eval requires complete turns (2 stones each)
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
      return { success: false, error: text.slice(0, 100), status: response.status };
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
      return { success: false, error: text.slice(0, 100), status: response.status };
    }
    
    const data = JSON.parse(text);
    return { success: true, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Convert axial to cube
function axialToCube(q, r) {
  return { x: q, y: -q - r, z: r };
}

// Test different game type identifiers
export async function runTests({ assert }) {
  console.log('\n=== Extended API Format Tests ===\n');
  
  const results = [];
  
  // TEST: Different config options
  console.log('TEST: Different config options');
  console.log('-'.repeat(50));
  
  const configTests = [
    { name: 'no config', payload: { position: { turnsJson: JSON.stringify({ turns: [] }) } } },
    { name: 'empty config', payload: { position: { turnsJson: JSON.stringify({ turns: [] }) }, config: {} } },
    { name: 'botName only', payload: { position: { turnsJson: JSON.stringify({ turns: [] }) }, config: { botName: 'kraken' } } },
    { name: 'botName random', payload: { position: { turnsJson: JSON.stringify({ turns: [] }) }, config: { botName: 'random' } } },
  ];
  
  for (const test of configTests) {
    const result = await testBestMove(test.payload, test.name);
    console.log(`  ${test.name}:`, result.success ? `OK` : `FAIL`);
    if (result.success) {
      console.log(`    stones: ${JSON.stringify(result.data.stones)}`);
    }
    results.push({ test: test.name, ...result });
  }

  // TEST: Eval with turns format - NOTE: Requires complete turns (2 stones each)
  console.log('\nTEST: Eval with turns format (2 stones per turn)');
  console.log('-'.repeat(50));
  
  const evalTests = [
    { name: 'empty', turns: [] },
    { name: '1 turn (2 stones)', turns: [{ stones: [axialToCube(1, 0), axialToCube(2, 0)] }] },
    { name: '2 turns (4 stones)', turns: [{ stones: [axialToCube(1, 0), axialToCube(2, 0)] }, { stones: [axialToCube(-1, 0), axialToCube(-2, 0)] }] },
    { name: '3 turns (6 stones)', turns: [{ stones: [axialToCube(1, 0), axialToCube(2, 0)] }, { stones: [axialToCube(-1, 0), axialToCube(-2, 0)] }, { stones: [axialToCube(1, -1), axialToCube(2, -2)] }] },
  ];
  
  for (const test of evalTests) {
    const payload = {
      position: { turnsJson: JSON.stringify({ turns: test.turns }) },
      config: { botName: 'kraken' }
    };
    const result = await testEval(payload, test.name);
    if (result.success) {
      console.log(`  ${test.name} (${test.turns.length} turns): score=${result.data.score?.toFixed(4)}, winProb=${result.data.winProb?.toFixed(4)}`);
    } else {
      console.log(`  ${test.name}: FAIL - ${result.error}`);
    }
    results.push({ test: test.name, stones: test.turns.length, ...result });
  }

  // Check for variation
  console.log('\n=== Variation Check ===');
  const evalResults = results.filter(r => r.test.startsWith('eval') && r.success);
  const scores = evalResults.map(r => r.data.score);
  const uniqueScores = [...new Set(scores)];
  console.log(`Unique scores found: ${uniqueScores.length}`);
  console.log(`Scores: ${uniqueScores.map(s => s?.toFixed(4)).join(', ')}`);
  
  if (uniqueScores.length <= 1) {
    console.log('\n❌ PROBLEM: All eval scores are identical - API not receiving position data!');
  } else {
    console.log('\n✓ GOOD: Eval scores vary by position');
  }
  
  // Test: Check if positionId changes
  console.log('\n=== Position ID Check ===');
  const posIds = evalResults.map(r => r.data.positionId);
  const uniquePosIds = [...new Set(posIds)];
  console.log(`Unique position IDs: ${uniquePosIds.length}`);
  
  if (uniquePosIds.length <= 1) {
    console.log('\n❌ PROBLEM: All position IDs are identical - API treating as same position!');
  } else {
    console.log('\n✓ GOOD: Position IDs vary');
  }

  // TEST: Best-move with turns format
  console.log('\nTEST: Best-move with turns format');
  console.log('-'.repeat(50));
  
  const moveTests = [
    { name: 'empty', turns: [] },
    { name: 'one stone', turns: [{ stones: [axialToCube(0, 0)] }] },
    { name: 'two stones', turns: [{ stones: [axialToCube(0, 0), axialToCube(1, 0)] }] },
    { name: 'one complete turn', turns: [{ stones: [axialToCube(1, 0), axialToCube(2, 0)] }] },
    { name: 'two complete turns', turns: [{ stones: [axialToCube(1, 0), axialToCube(2, 0)] }, { stones: [axialToCube(-1, 0), axialToCube(0, -1)] }] },
  ];
  
  for (const test of moveTests) {
    const payload = {
      position: { turnsJson: JSON.stringify({ turns: test.turns }) },
      config: { botName: 'kraken' }
    };
    const result = await testBestMove(payload, test.name);
    if (result.success) {
      const stone = result.data.stones[0];
      console.log(`  ${test.name}: ${stone.x},${stone.y},${stone.z}`);
    } else {
      console.log(`  ${test.name}: FAIL - ${result.error}`);
    }
    results.push({ test: `move_${test.name}`, ...result });
  }

  console.log('\n✓ Extended API tests completed');
}
