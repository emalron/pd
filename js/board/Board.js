import { CONFIG } from '../config.js';
import { SymbolNode } from './SymbolNode.js';
import { MatchFinder } from './MatchFinder.js';

// ============================================================
// Board — owns the grid state, symbol nodes, and all board-level
// operations (swap, match, gravity, combo display).
// ============================================================

export class Board {
    /**
     * @param {Phaser.Scene} scene
     * @param {string} mode  'demo' | 'clear'
     */
    constructor(scene, mode = 'demo') {
        this.scene = scene;
        this.mode = mode;
        this.rows = CONFIG.BOARD.ROWS;
        this.cols = CONFIG.BOARD.COLS;
        this.cellSize = CONFIG.BOARD.CELL_SIZE;

        // Centre the board horizontally, place it slightly below vertical centre
        const totalW = this.cols * this.cellSize;
        const totalH = this.rows * this.cellSize;
        this.originX = (CONFIG.GAME.WIDTH - totalW) / 2;
        this.originY = (CONFIG.GAME.HEIGHT - totalH) / 2 + 60;

        /** @type {(number|null)[][]} */
        this.grid = [];
        /** @type {(SymbolNode|null)[][]} */
        this.nodes = [];

        this._drawBackground();

        if (mode === 'clear') {
            this._initClearGrid();
        } else {
            this._initGrid();
        }
    }

    // ==========================================================
    // Initialisation
    // ==========================================================

    /** @private Draw board background and cell slots. */
    _drawBackground() {
        const bg = this.scene.add.graphics();
        const pad = 10;
        const w = this.cols * this.cellSize + pad * 2;
        const h = this.rows * this.cellSize + pad * 2;

        bg.fillStyle(CONFIG.BOARD.BG_COLOR, 0.8);
        bg.fillRoundedRect(
            this.originX - pad, this.originY - pad,
            w, h,
            CONFIG.BOARD.CORNER_RADIUS,
        );

        const gap = CONFIG.BOARD.GAP;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const x = this.originX + c * this.cellSize + gap / 2;
                const y = this.originY + r * this.cellSize + gap / 2;
                const size = this.cellSize - gap;
                bg.fillStyle(CONFIG.BOARD.CELL_BG_COLOR, CONFIG.BOARD.CELL_BG_ALPHA);
                bg.fillRoundedRect(x, y, size, size, 8);
            }
        }
        bg.setDepth(-1);
    }

    /** @private Fill the grid with random symbols, guaranteeing no initial matches. */
    _initGrid() {
        const numTypes = CONFIG.SYMBOLS.length;
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            this.nodes[r] = [];
            for (let c = 0; c < this.cols; c++) {
                let typeId;
                do {
                    typeId = Phaser.Math.Between(0, numTypes - 1);
                } while (this._wouldMatch(r, c, typeId));

                this.grid[r][c] = typeId;
                const pos = this.getCellCenter(r, c);
                this.nodes[r][c] = new SymbolNode(this.scene, typeId, pos.x, pos.y);
            }
        }
    }

    /** @private Would placing `typeId` at (row, col) create a 3-in-a-row? */
    _wouldMatch(row, col, typeId) {
        if (col >= 2 &&
            this.grid[row][col - 1] === typeId &&
            this.grid[row][col - 2] === typeId) return true;
        if (row >= 2 &&
            this.grid[row - 1][col] === typeId &&
            this.grid[row - 2][col] === typeId) return true;
        return false;
    }

    // ----------------------------------------------------------
    // Clear-mode grid: every symbol count is a multiple of 3
    // ----------------------------------------------------------

    /** @private Generate counts per type (each multiple of 3, sum = rows*cols). */
    _generateClearCounts() {
        const numTypes = CONFIG.SYMBOLS.length;
        const total = this.rows * this.cols; // 30
        const counts = new Array(numTypes).fill(3); // 6×3 = 18
        let remaining = total - numTypes * 3;       // 12

        while (remaining > 0) {
            const t = Phaser.Math.Between(0, numTypes - 1);
            counts[t] += 3;
            remaining -= 3;
        }
        return counts;
    }

    /** @private Fill the grid so every type appears a multiple-of-3 times, no initial matches. */
    _initClearGrid() {
        const counts = this._generateClearCounts();
        const remaining = [...counts];

        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            this.nodes[r] = [];
            for (let c = 0; c < this.cols; c++) {
                // Collect types that still have budget AND don't create a match
                const valid = [];
                for (let t = 0; t < remaining.length; t++) {
                    if (remaining[t] > 0 && !this._wouldMatch(r, c, t)) {
                        valid.push(t);
                    }
                }

                let typeId;
                if (valid.length > 0) {
                    typeId = valid[Phaser.Math.Between(0, valid.length - 1)];
                } else {
                    // Rare fallback — pick any remaining type
                    typeId = remaining.findIndex(n => n > 0);
                }

                remaining[typeId]--;
                this.grid[r][c] = typeId;
                const pos = this.getCellCenter(r, c);
                this.nodes[r][c] = new SymbolNode(this.scene, typeId, pos.x, pos.y);
            }
        }
    }

    // ----------------------------------------------------------
    // Board-state queries
    // ----------------------------------------------------------

    /** True if every cell is empty (clear-mode win condition). */
    isClear() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] !== null) return false;
            }
        }
        return true;
    }

    /** Count non-null cells remaining. */
    getRemainingCount() {
        let count = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] !== null) count++;
            }
        }
        return count;
    }

    // ==========================================================
    // Coordinate helpers
    // ==========================================================

    /** World-space centre of a cell. */
    getCellCenter(row, col) {
        return {
            x: this.originX + col * this.cellSize + this.cellSize / 2,
            y: this.originY + row * this.cellSize + this.cellSize / 2,
        };
    }

    /** Returns {row, col} or null if (px, py) is outside the grid. */
    getCellFromPoint(px, py) {
        const col = Math.floor((px - this.originX) / this.cellSize);
        const row = Math.floor((py - this.originY) / this.cellSize);
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            return { row, col };
        }
        return null;
    }

    // ==========================================================
    // Drag-time swap
    // ==========================================================

    /**
     * Swap during drag.
     * The dragged orb is logically at (fromR, fromC) and the cursor
     * entered (toR, toC). After the swap the displaced orb animates
     * to (fromR, fromC); the dragged orb stays under the cursor.
     */
    swapDuringDrag(fromR, fromC, toR, toC) {
        // Swap data
        [this.grid[fromR][fromC], this.grid[toR][toC]] =
            [this.grid[toR][toC], this.grid[fromR][fromC]];
        [this.nodes[fromR][fromC], this.nodes[toR][toC]] =
            [this.nodes[toR][toC], this.nodes[fromR][fromC]];

        // Animate the displaced node (now at fromR, fromC) to its new cell
        const displaced = this.nodes[fromR][fromC];
        const pos = this.getCellCenter(fromR, fromC);
        this.scene.tweens.add({
            targets: displaced.container,
            x: pos.x,
            y: pos.y,
            duration: CONFIG.ANIM.SWAP_MS,
            ease: 'Power2',
        });
    }

    // ==========================================================
    // Match detection (delegates to MatchFinder)
    // ==========================================================

    findMatches() {
        return MatchFinder.findMatches(this.grid, this.rows, this.cols);
    }

    // ==========================================================
    // Combo resolution — sequential per-group animation
    // ==========================================================

    /**
     * Animate each match group disappearing one by one.
     * @param {Array} groups  output of findMatches
     * @param {number} comboStart  running combo count (for cascades)
     * @returns {Promise<number>} final combo count after this wave
     */
    async resolveMatches(groups, comboStart = 0, onGroupResolved = null) {
        let combo = comboStart;

        for (const group of groups) {
            combo++;

            // Floating combo number + particle burst
            this._showComboPopup(combo, group);
            this._playMatchBurst(group);

            // Animate all cells in this group simultaneously
            const anims = group.cells.map(({ row, col }) =>
                this.nodes[row][col].animateMatch());
            await Promise.all(anims);

            // Remove from data
            for (const { row, col } of group.cells) {
                if (this.nodes[row][col]) {
                    this.nodes[row][col].destroy();
                    this.nodes[row][col] = null;
                    this.grid[row][col] = null;
                }
            }

            // Per-group callback (used by BattleScene for inline combat)
            if (onGroupResolved) await onGroupResolved(group, combo);

            // Brief pause before the next combo
            await this._delay(CONFIG.ANIM.COMBO_PAUSE_MS);
        }

        return combo;
    }

    /** @private Show a floating "N" combo number at the group centre. */
    _showComboPopup(num, group) {
        let cx = 0, cy = 0;
        for (const { row, col } of group.cells) {
            const p = this.getCellCenter(row, col);
            cx += p.x;
            cy += p.y;
        }
        cx /= group.cells.length;
        cy /= group.cells.length;

        const txt = this.scene.add.text(cx, cy, `${num}`, {
            fontSize: '52px',
            fontFamily: 'Arial Black, sans-serif',
            fontStyle: 'bold',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5).setDepth(2000).setScale(0);

        // Pop-in
        this.scene.tweens.add({
            targets: txt,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 180,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Float up + fade
                this.scene.tweens.add({
                    targets: txt,
                    y: cy - 60,
                    scaleX: 1,
                    scaleY: 1,
                    alpha: 0,
                    duration: 600,
                    ease: 'Power2',
                    onComplete: () => txt.destroy(),
                });
            },
        });
    }

    /** @private Fire-and-forget particle burst at the centre of a matched group. */
    _playMatchBurst(group) {
        let cx = 0, cy = 0;
        for (const { row, col } of group.cells) {
            const p = this.getCellCenter(row, col);
            cx += p.x;
            cy += p.y;
        }
        cx /= group.cells.length;
        cy /= group.cells.length;

        const sym = CONFIG.SYMBOLS[group.type];
        const color = sym ? sym.color : 0xffffff;
        const count = 6;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const particle = this.scene.add.circle(cx, cy, 5, color).setDepth(1500).setAlpha(0.9);

            this.scene.tweens.add({
                targets: particle,
                x: cx + Math.cos(angle) * 60,
                y: cy + Math.sin(angle) * 60,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 300,
                ease: 'Power2',
                onComplete: () => particle.destroy(),
            });
        }
    }

    // ==========================================================
    // Gravity — drop existing orbs, spawn new ones from above
    // ==========================================================

    /** @returns {Promise} resolves when all fall animations finish */
    async applyGravity() {
        const promises = [];

        for (let c = 0; c < this.cols; c++) {
            // Gather surviving symbols bottom-to-top
            const existing = [];
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] !== null) {
                    existing.push({
                        typeId: this.grid[r][c],
                        node: this.nodes[r][c],
                        fromRow: r,
                    });
                }
            }

            const emptyCount = this.rows - existing.length;
            if (emptyCount === 0) continue;

            // Clear column
            for (let r = 0; r < this.rows; r++) {
                this.grid[r][c] = null;
                this.nodes[r][c] = null;
            }

            // Place existing symbols at the bottom
            for (let i = 0; i < existing.length; i++) {
                const targetRow = this.rows - 1 - i;
                const { typeId, node, fromRow } = existing[i];
                this.grid[targetRow][c] = typeId;
                this.nodes[targetRow][c] = node;

                if (targetRow !== fromRow) {
                    const pos = this.getCellCenter(targetRow, c);
                    const dist = targetRow - fromRow;
                    promises.push(
                        node.animateFallTo(pos.x, pos.y,
                            CONFIG.ANIM.FALL_MS_PER_CELL * (dist + 1)),
                    );
                }
            }

            // Spawn new symbols (demo mode only — clear mode leaves gaps)
            if (this.mode !== 'clear') {
                for (let i = 0; i < emptyCount; i++) {
                    const targetRow = i;
                    const typeId = Phaser.Math.Between(0, CONFIG.SYMBOLS.length - 1);
                    this.grid[targetRow][c] = typeId;

                    const target = this.getCellCenter(targetRow, c);
                    const startY = this.originY - (emptyCount - i) * this.cellSize + this.cellSize / 2;

                    const node = new SymbolNode(this.scene, typeId, target.x, startY);
                    this.nodes[targetRow][c] = node;

                    const fallDist = emptyCount + 1;
                    promises.push(
                        node.animateFallTo(target.x, target.y,
                            CONFIG.ANIM.FALL_MS_PER_CELL * fallDist),
                    );
                }
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }

    // ==========================================================
    // Utility
    // ==========================================================

    /** Promise-based delay using Phaser's timer. */
    _delay(ms) {
        return new Promise(resolve => this.scene.time.delayedCall(ms, resolve));
    }
}
