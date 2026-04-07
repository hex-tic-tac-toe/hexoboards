#!/usr/bin/env node
/**
 * Test Runner for Hexoboards
 *
 * Runs all test files in the tests/ directory.
 * Usage: node scripts/run-tests.mjs [pattern]
 *
 * Examples:
 *   node scripts/run-tests.mjs           # Run all tests
 *   node scripts/run-tests.mjs hexgrid   # Run only HexGrid tests
 *   node scripts/run-tests.mjs match     # Run only Match tests
 */

import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = join(__dirname, '..', 'tests');

// Test statistics
let totalSuites = 0;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// Global test context
const testContext = { assert };

/**
 * Load and run a test file
 */
async function runTestFile(filePath) {
  const fileName = filePath.split('/').pop();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${fileName}`);
  console.log('='.repeat(60));

  try {
    // Import the test module
    const module = await import(filePath);

    if (module.runTests) {
      await module.runTests(testContext);
    } else {
      console.log('  (No exported runTests function found)');
    }
  } catch (error) {
    console.error(`\n  FAIL: Error loading test file: ${error.message}`);
    failures.push({ file: fileName, error: error.message });
    failedTests++;
  }
}

/**
 * Main entry point
 */
async function main() {
  const pattern = process.argv[2] || '';

  console.log('Hexoboards Test Runner');
  console.log('======================');
  if (pattern) {
    console.log(`Filter: "${pattern}"`);
  }

  try {
    // Check if tests directory exists
    await stat(TESTS_DIR);
  } catch {
    console.error(`\nError: Tests directory not found: ${TESTS_DIR}`);
    console.error('Creating tests directory structure...');
    await createTestStructure();
  }

  // Get all test files
  const files = await readdir(TESTS_DIR);
  const testFiles = files
    .filter(f => f.endsWith('.test.mjs') || f.endsWith('.spec.mjs'))
    .filter(f => !pattern || f.toLowerCase().includes(pattern.toLowerCase()))
    .map(f => join(TESTS_DIR, f));

  if (testFiles.length === 0) {
    console.log('\nNo test files found.');
    if (pattern) {
      console.log(`No tests matching "${pattern}"`);
    }
    process.exit(0);
  }

  // Run each test file
  for (const file of testFiles) {
    await runTestFile(file);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total test files: ${testFiles.length}`);
  console.log(`Tests passed: ${passedTests}`);
  console.log(`Tests failed: ${failedTests}`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => {
      console.log(`  - ${f.file}: ${f.error}`);
    });
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

/**
 * Create the initial test directory structure
 */
async function createTestStructure() {
  const { mkdir, writeFile } = await import('node:fs/promises');

  await mkdir(TESTS_DIR, { recursive: true });

  // Create a sample test file
  const sampleTest = `import assert from 'node:assert/strict';

export async function runTests({ assert }) {
  console.log('  Sample test running...');
  assert.strictEqual(1 + 1, 2, 'Basic math works');
  console.log('  ✓ Sample test passed');
}
`;

  await writeFile(join(TESTS_DIR, 'sample.test.mjs'), sampleTest);
  console.log(`Created ${TESTS_DIR}/sample.test.mjs`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
