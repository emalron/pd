import { CONFIG } from '../config.js';
import { Board } from '../board/Board.js';
import { DragController } from '../input/DragController.js';

// ============================================================
// GameScene — main scene with a simple state machine:
//   IDLE  →  DRAGGING  →  RESOLVING  ⇄  FALLING  →  IDLE
// Supports modes: 'demo' (endless) and 'clear' (clear the board).
// ============================================================

const State = Object.freeze({
    IDLE: 'idle',
    DRAGGING: 'dragging',
    RESOLVING: 'resolving',
    FALLING: 'falling',
    CLEAR_WIN: 'clear_win',
});

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    // ----------------------------------------------------------
    // Phaser lifecycle
    // ----------------------------------------------------------

    init(data) {
        this.mode = (data && data.mode) || 'demo';
        this.state = State.IDLE;
        this.totalCombo = 0;
        this.maxCombo = 0;
    }

    create() {
        this.board = new Board(this, this.mode);
        this.drag = new DragController(this, this.board);

        this._createUI();
    }

    update() {
        this.drag.update();
    }

    // ----------------------------------------------------------
    // UI
    // ----------------------------------------------------------

    /** @private */
    _createUI() {
        const cx = CONFIG.GAME.WIDTH / 2;

        // Mode label
        const modeLabel = this.mode === 'clear' ? 'CLEAR MODE' : 'DEMO MODE';
        const modeColor = this.mode === 'clear' ? '#DA70D6' : '#70B8DA';

        this.add.text(cx, 22, modeLabel, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: modeColor,
            letterSpacing: 2,
        }).setOrigin(0.5);

        // Title
        this.add.text(cx, 50, 'PUZZLE & DRAGONS', {
            fontSize: '26px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#FFD700',
            stroke: '#8B6914',
            strokeThickness: 3,
        }).setOrigin(0.5);

        // Combo counter
        this.comboLabel = this.add.text(cx, 95, '', {
            fontSize: '40px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5).setDepth(2000);

        // Max combo
        this.maxComboLabel = this.add.text(cx, 135, '', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA',
        }).setOrigin(0.5);

        // Remaining count (clear mode only)
        this.remainingLabel = this.add.text(cx, 160, '', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#DA70D6',
        }).setOrigin(0.5);

        if (this.mode === 'clear') {
            this._updateRemainingUI();
        }

        // Instruction / bottom area
        const boardBottom = this.board.originY +
            this.board.rows * this.board.cellSize + 24;

        this.instructionText = this.add.text(cx, boardBottom, 'Drag an orb to begin!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#8888AA',
        }).setOrigin(0.5);

        // Back to menu button
        this._createBackButton(boardBottom + 50);
    }

    /** @private */
    _createBackButton(y) {
        const cx = CONFIG.GAME.WIDTH / 2;
        const w = 160;
        const h = 40;

        const bg = this.add.graphics();
        bg.fillStyle(0x333355, 0.8);
        bg.fillRoundedRect(cx - w / 2, y - h / 2, w, h, 10);
        bg.lineStyle(1, 0x555577, 1);
        bg.strokeRoundedRect(cx - w / 2, y - h / 2, w, h, 10);

        const label = this.add.text(cx, y, 'MENU', {
            fontSize: '16px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#AAAACC',
        }).setOrigin(0.5);

        const hit = this.add.rectangle(cx, y, w, h)
            .setInteractive({ useHandCursor: true })
            .setFillStyle(0xFFFFFF, 0);

        hit.on('pointerover', () => label.setColor('#FFD700'));
        hit.on('pointerout', () => label.setColor('#AAAACC'));
        hit.on('pointerdown', () => this.scene.start('MenuScene'));
    }

    // ----------------------------------------------------------
    // State queries (used by DragController)
    // ----------------------------------------------------------

    canStartDrag() {
        return this.state === State.IDLE;
    }

    // ----------------------------------------------------------
    // Drag callbacks
    // ----------------------------------------------------------

    onDragStart() {
        this.state = State.DRAGGING;
        this.instructionText.setVisible(false);
        this.comboLabel.setText('').setAlpha(1);
    }

    async onDragEnd() {
        this.state = State.RESOLVING;
        this.totalCombo = 0;

        await this._resolveLoop();

        // Check clear-mode win
        if (this.mode === 'clear' && this.board.isClear()) {
            this._showClearWin();
            return;
        }

        // Fade out combo label after a short display
        if (this.totalCombo > 0) {
            await this._delay(800);
            this.tweens.add({
                targets: this.comboLabel,
                alpha: 0,
                duration: 400,
            });
        }

        this.state = State.IDLE;
        this.instructionText.setVisible(true);
    }

    // ----------------------------------------------------------
    // Core resolve loop (matches → combos → gravity → cascade)
    // ----------------------------------------------------------

    /** @private */
    async _resolveLoop() {
        while (true) {
            const groups = this.board.findMatches();
            if (groups.length === 0) break;

            this.totalCombo = await this.board.resolveMatches(groups, this.totalCombo);
            this._updateComboUI();

            if (this.mode === 'clear') {
                this._updateRemainingUI();
            }

            // Gravity
            this.state = State.FALLING;
            await this.board.applyGravity();
            this.state = State.RESOLVING;

            await this._delay(150);
        }
    }

    /** @private */
    _updateComboUI() {
        this.comboLabel.setText(`${this.totalCombo} COMBO!`);

        if (this.totalCombo > this.maxCombo) {
            this.maxCombo = this.totalCombo;
            this.maxComboLabel.setText(`Max Combo: ${this.maxCombo}`);
        }
    }

    /** @private */
    _updateRemainingUI() {
        const rem = this.board.getRemainingCount();
        this.remainingLabel.setText(`Remaining: ${rem}`);
    }

    // ----------------------------------------------------------
    // Clear-mode win celebration
    // ----------------------------------------------------------

    /** @private */
    _showClearWin() {
        this.state = State.CLEAR_WIN;

        const cx = CONFIG.GAME.WIDTH / 2;
        const cy = CONFIG.GAME.HEIGHT / 2;

        // Dim overlay
        const overlay = this.add.rectangle(cx, cy,
            CONFIG.GAME.WIDTH, CONFIG.GAME.HEIGHT, 0x000000, 0.6)
            .setDepth(3000);

        // BOARD CLEAR text
        const clearText = this.add.text(cx, cy - 60, 'BOARD\nCLEAR!', {
            fontSize: '64px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
            lineSpacing: 4,
        }).setOrigin(0.5).setDepth(3001).setScale(0);

        this.tweens.add({
            targets: clearText,
            scaleX: 1,
            scaleY: 1,
            duration: 500,
            ease: 'Back.easeOut',
        });

        // Combo summary
        this.add.text(cx, cy + 50, `Total Combo: ${this.totalCombo}`, {
            fontSize: '24px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(3001);

        // Buttons
        this._createWinButton(cx - 90, cy + 130, 'RETRY', () => {
            this.scene.restart({ mode: 'clear' });
        });
        this._createWinButton(cx + 90, cy + 130, 'MENU', () => {
            this.scene.start('MenuScene');
        });
    }

    /** @private */
    _createWinButton(x, y, label, onClick) {
        const w = 140;
        const h = 44;

        const bg = this.add.graphics().setDepth(3001);
        bg.fillStyle(0x444466, 0.9);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
        bg.lineStyle(1, 0x8888AA, 1);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);

        const txt = this.add.text(x, y, label, {
            fontSize: '18px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#CCCCEE',
        }).setOrigin(0.5).setDepth(3001);

        const hit = this.add.rectangle(x, y, w, h)
            .setInteractive({ useHandCursor: true })
            .setFillStyle(0xFFFFFF, 0)
            .setDepth(3002);

        hit.on('pointerover', () => txt.setColor('#FFD700'));
        hit.on('pointerout', () => txt.setColor('#CCCCEE'));
        hit.on('pointerdown', onClick);
    }

    // ----------------------------------------------------------
    // Utility
    // ----------------------------------------------------------

    /** @private Promise-wrapped Phaser timer. */
    _delay(ms) {
        return new Promise(resolve => this.time.delayedCall(ms, resolve));
    }
}
