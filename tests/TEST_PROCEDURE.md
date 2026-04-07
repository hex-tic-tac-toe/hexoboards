# Hexoboards Test Procedure

## Overview

This document describes the comprehensive test suite for Hexoboards and how to run it.

## Test Structure

All tests are located in `tests/` directory with the following files:

```
tests/
├── hexgrid.test.mjs       # HexGrid module tests
├── doc.test.mjs           # Doc module tests
├── urlcodec.test.mjs      # URLCodec tests
├── windetector.test.mjs   # WinDetector tests
├── moveannotator.test.mjs # MoveAnnotator tests
├── bot.test.mjs           # Bot tests
├── hexlayout.test.mjs     # HexLayout tests
├── htn.test.mjs           # HTN notation tests
├── notation.test.mjs      # Notation tests
├── eval.test.mjs          # Eval tests
├── layout.test.mjs        # Layout tests
└── TEST_PROCEDURE.md      # This file
```

## Running Tests

### Run All Tests

```bash
node scripts/run-tests.mjs
```

### Run Specific Test File

```bash
# Run only HexGrid tests
node scripts/run-tests.mjs hexgrid

# Run only Doc tests
node scripts/run-tests.mjs doc

# Run only WinDetector tests
node scripts/run-tests.mjs windetector
```

### Run Tests with Pattern

```bash
# Run all game logic tests
node scripts/run-tests.mjs "win\|bot\|eval"
```

## Test Categories

### 1. Unit Tests

Each module has comprehensive unit tests covering:
- **Creation/Initialization**: Testing constructors and factory methods
- **Core Operations**: Testing main functionality
- **Edge Cases**: Testing boundary conditions and error handling
- **Invalid Input**: Testing how modules handle bad input

### 2. Integration Tests

Tests verify module interactions:
- Grid → URLCodec encode/decode roundtrip
- HTN notation → Grid building
- Move annotation with actual game positions

### 3. Game Logic Tests

Comprehensive tests for game rules:
- Win detection in all three directions
- Win with exactly 6 stones
- Win with more than 6 stones
- No win with 5 or fewer stones
- Different player stones don't interfere

## Expected Results

All tests should pass with output similar to:

```
Hexoboards Test Runner
======================

============================================================
Running: hexgrid.test.mjs
============================================================
  HexGrid Tests
  -------------
  Test 1: Grid creation...
    ✓ Grid creation works
  Test 2: Cell operations...
    ✓ Cell operations work
  ...
  ✓ All HexGrid tests passed!

============================================================
Running: doc.test.mjs
============================================================
  Doc Tests
  ---------
  ...
  ✓ All Doc tests passed!

...

============================================================
Test Summary
============================================================
Total test files: 10
Tests passed: 85
Tests failed: 0
```

## Adding New Tests

To add tests for a new module:

1. Create a test file: `tests/<module>.test.mjs`
2. Export a `runTests` function:

```javascript
export async function runTests({ assert }) {
  console.log('  Module Tests');
  console.log('  ------------');

  // Test 1
  console.log('  Test 1: Description...');
  // ... test code ...
  console.log('    ✓ Test passed');

  console.log('');
  console.log('  ✓ All Module tests passed!');
  console.log('');
}
```

3. Run the test: `node scripts/run-tests.mjs <module>`

## Continuous Integration

For CI/CD pipelines, run:

```bash
# Run all tests
node scripts/run-tests.mjs

# Or run with specific exit codes
node scripts/run-tests.mjs || exit 1
```

The test runner exits with code 0 if all tests pass, or 1 if any fail.

## Troubleshooting

### Test fails with "Cannot find module"

Make sure you're running from the hexoboards directory:
```bash
cd /home/kiwi/dev/HexTTT/hexoboards
node scripts/run-tests.mjs
```

### Test fails with "assert is not defined"

The test runner provides assert in the context. Make sure your test function signature is:
```javascript
export async function runTests({ assert }) {
```

### Module import errors

Ensure the module exports correctly and the path is correct:
```javascript
import { ModuleName } from '../public/strategies/js/modules/ModuleFile.js';
```

## Maintenance

- Update tests when adding new module features
- Add edge case tests when bugs are found
- Keep test descriptions clear and specific
- Run tests before committing changes
