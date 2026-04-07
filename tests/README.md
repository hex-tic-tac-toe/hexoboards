# Hexoboards Test Suite

## Overview

This directory contains comprehensive tests for the Hexoboards application. The tests are organized by module and cover unit tests, integration tests, and game logic tests.

## Test Files

### Core Module Tests

- **hexgrid.test.mjs** - Tests for the HexGrid module (grid creation, cell operations, state management)
- **doc.test.mjs** - Tests for the Doc module (document structure, CRUD operations, migrations)
- **layout.test.mjs** - Tests for the Layout module (layout constants, dimension calculations)

### Game Logic Tests

- **windetector.test.mjs** - Tests for win detection in all three hex directions
- **moveannotator.test.mjs** - Tests for move annotation and analysis
- **bot.test.mjs** - Tests for AI bot functionality
- **eval.test.mjs** - Tests for position evaluation

### Notation Tests

- **urlcodec.test.mjs** - Tests for URL encoding/decoding of board states
- **htn.test.mjs** - Tests for Hextic notation parsing and building
- **notation.test.mjs** - Tests for all notation formats (BKE, HTN, Axial)
- **hexlayout.test.mjs** - Tests for hex layout calculations

## Running Tests

### Run All Tests

```bash
npm test
# or
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

# Run all notation tests
node scripts/run-tests.mjs "notation\|htn\|url"
```

## Test Coverage

### Core Functionality

- **Grid Operations**: Grid creation, cell access, state management, serialization
- **Document Structure**: Creating sections, text nodes, positions, and matches
- **Layout Calculations**: Board dimensions, panel sizing, responsive layouts

### Game Logic

- **Win Detection**: All three axes (horizontal, diagonal, anti-diagonal)
- **Move Analysis**: Potential win detection, threat analysis
- **AI Behavior**: Bot move selection, difficulty levels
- **Position Evaluation**: Score calculation, advantage detection

### Notation Systems

- **BKE Format**: Board knowledge encoding
- **HTN Format**: Hextic notation for games
- **Axial Format**: Simple coordinate notation
- **URL Encoding**: Compact board state for sharing

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
  // ... test code using assert ...
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
npm test

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

## Test Statistics

Current test coverage:
- **12 test files**
- **85+ individual tests**
- **100% module coverage** for core functionality

## Maintenance

- Update tests when adding new module features
- Add edge case tests when bugs are found
- Keep test descriptions clear and specific
- Run tests before committing changes
- Review test coverage regularly

## Future Enhancements

Potential areas for additional testing:
- Browser integration tests (using Playwright or Puppeteer)
- Performance benchmarks
- Memory leak detection
- Visual regression tests for board rendering
- End-to-end game flow tests
