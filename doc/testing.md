# Testing Guide

## Quick Start

```bash
npm test          # Run all tests once
npm run test:watch  # Run in watch mode (re-runs on file changes)
```

## Test Structure

```
tests/
├── CombatResolver.test.js   # Combat calculation logic
└── PlayerState.test.js       # Player state management
```

Tests use [Vitest](https://vitest.dev/) with ES module imports.

## Writing New Tests

### Testable Code (no Phaser dependency)

Modules like `CombatResolver` and `PlayerState` import only `CONFIG` from `config.js`. Mock it at the top of your test file:

```js
import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/config.js', () => ({
    CONFIG: {
        ROGUELIKE: {
            STARTING_HP: 100,
            // ... only the fields your module uses
        },
    },
}));

const { MyModule } = await import('../js/path/to/module.js');
```

### Browser-dependent Code

Modules that use Phaser APIs (`Board`, `SymbolNode`, `DragController`, scenes) cannot be tested with Vitest directly because Phaser requires a browser DOM and canvas. Options:

1. **Extract pure logic** into separate modules (like `CombatResolver`) that can be tested in Node.
2. **Use Phaser's headless mode** with `jsdom` environment (requires additional setup).
3. **E2E testing** with Playwright or Cypress for full browser testing.

The recommended approach is option 1: keep calculation and state logic in pure modules, test those, and verify visual behavior manually in the browser.

## Test Conventions

- One test file per source module: `tests/ModuleName.test.js`
- Use `describe` blocks to group by method
- Include comments with expected calculation steps for numeric assertions
- Use `beforeEach` to create fresh instances for stateful classes
