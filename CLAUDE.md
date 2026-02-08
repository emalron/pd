# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Project

ES modules require HTTP serving (not `file://`):
```bash
python -m http.server 9090
# or
npx http-server
```
Then open `http://localhost:9090`. No build step or bundler required.

## Architecture

Phaser 3 (v3.60.0, loaded via CDN) match-3 puzzle game inspired by Puzzle & Dragons.

### Scene Flow
`MenuScene` → `GameScene(mode)` where mode is `'demo'` (endless) or `'clear'` (clear-the-board).

### GameScene State Machine
```
IDLE → DRAGGING → RESOLVING ⇄ FALLING → IDLE
                      ↓
                 CLEAR_WIN (clear mode only)
```
`canStartDrag()` gates input; the resolve loop (`_resolveLoop`) is fully async/await using Promise-wrapped Phaser tweens.

### Module Responsibilities
- **`config.js`** — Single source of truth for all tunable constants (board dimensions, symbol colors, animation timings, drag timeout).
- **`Board.js`** — Grid state (`grid[][]` of type IDs, `nodes[][]` of SymbolNodes). Handles swap-during-drag, combo resolution (sequential per-group animation), gravity, and mode-dependent behavior (demo spawns new orbs; clear does not).
- **`MatchFinder.js`** — Static utility. Phase 1: mark 3+ horizontal/vertical runs. Phase 2: flood-fill to group connected matched cells of same type. Returns `Array<{ type, cells[] }>`. Designed to be subclassed for custom match rules.
- **`SymbolNode.js`** — Phaser Container wrapping circle graphics + selection glow. All animations (`animateMatch`, `animateMoveTo`, `animateFallTo`) return Promises. Override `createVisual(typeId)` to swap circles for sprites.
- **`DragController.js`** — Pointer events (mouse + touch via Phaser abstraction). Manages drag state, cell-entry swap triggers, timeout countdown, and circular gauge rendering.

### Key Patterns
- **Promise-based animation chaining**: Every animation returns a Promise; `await Promise.all()` for parallel anims, sequential `await` for ordered steps.
- **Model/View split**: `Board.grid[][]` (data) vs `Board.nodes[][]` (SymbolNode visuals).
- **Clear mode grid generation**: `_initClearGrid()` distributes symbols in multiples of 3 across 30 cells (6×5), placing greedily to avoid initial matches.
- **Depth layering**: Board background at -1, normal orbs at 0, dragged orb at 1000, gauge at 2001, combo popups at 2000, win overlay at 3000+.

## Extensibility Hooks

| Extension | How |
|-----------|-----|
| Sprites instead of circles | Override `SymbolNode.createVisual()` to return a Sprite |
| New match rules (L/T/cross) | Subclass `MatchFinder`, keep return format `{type, cells[]}` |
| Mobile touch | Already abstracted via Phaser pointer events |
| New game modes | Add to `MenuScene`, pass mode string to `GameScene` via `scene.start()` data |
| New symbol types | Add entries to `CONFIG.SYMBOLS` array |
