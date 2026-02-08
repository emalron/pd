import { CONFIG } from '../config.js';

// ============================================================
// DragController — handles pointer input (mouse & touch) and
// the circular timeout gauge that surrounds the dragged orb.
//
// EXTENSIBILITY (mobile):
//   Phaser's `pointer` events already abstract mouse vs touch.
//   For multi-touch, listen to specific pointer IDs.
// ============================================================

export class DragController {
    /**
     * @param {Phaser.Scene} scene
     * @param {import('../board/Board.js').Board} board
     */
    constructor(scene, board) {
        this.scene = scene;
        this.board = board;

        this.isDragging = false;
        /** Current logical grid position of the dragged orb */
        this.dragRow = -1;
        this.dragCol = -1;
        this.dragStartTime = 0;

        // Graphics layer for the timeout gauge
        this.gaugeGfx = scene.add.graphics().setDepth(2001);
        this.gaugeGfx.setVisible(false);

        this._bindInput();
    }

    // ----------------------------------------------------------
    // Input binding (works for both mouse and touch)
    // ----------------------------------------------------------

    /** @private */
    _bindInput() {
        this.scene.input.on('pointerdown', this._onDown, this);
        this.scene.input.on('pointermove', this._onMove, this);
        this.scene.input.on('pointerup', this._onUp, this);
    }

    /** @private */
    _onDown(pointer) {
        if (this.isDragging) return;
        if (!this.scene.canStartDrag()) return;

        const cell = this.board.getCellFromPoint(pointer.x, pointer.y);
        if (!cell) return;

        this.isDragging = true;
        this.dragRow = cell.row;
        this.dragCol = cell.col;
        this.dragStartTime = this.scene.time.now;

        const node = this.board.nodes[this.dragRow][this.dragCol];
        node.select();

        this.gaugeGfx.setVisible(true);

        this.scene.onDragStart();
    }

    /** @private */
    _onMove(pointer) {
        if (!this.isDragging) return;

        // Move the dragged orb to follow the pointer
        const node = this.board.nodes[this.dragRow][this.dragCol];
        node.setPosition(pointer.x, pointer.y);

        // If the pointer entered a different cell, swap
        const cell = this.board.getCellFromPoint(pointer.x, pointer.y);
        if (cell && (cell.row !== this.dragRow || cell.col !== this.dragCol)) {
            this.board.swapDuringDrag(
                this.dragRow, this.dragCol,
                cell.row, cell.col,
            );
            this.dragRow = cell.row;
            this.dragCol = cell.col;
        }
    }

    /** @private */
    _onUp(_pointer) {
        if (!this.isDragging) return;
        this._endDrag();
    }

    // ----------------------------------------------------------
    // Per-frame update (called from scene.update)
    // ----------------------------------------------------------

    update() {
        if (!this.isDragging) return;

        const elapsed = this.scene.time.now - this.dragStartTime;
        const timeout = this.scene.getDragTimeout?.() ?? CONFIG.DRAG.TIMEOUT_MS;
        const remaining = Math.max(0, timeout - elapsed);
        const fraction = remaining / timeout;

        if (remaining <= 0) {
            this._endDrag();
            return;
        }

        this._drawGauge(fraction);
    }

    // ----------------------------------------------------------
    // Timer gauge rendering
    // ----------------------------------------------------------

    /** @private Draw circular arc gauge around the dragged orb. */
    _drawGauge(fraction) {
        const node = this.board.nodes[this.dragRow][this.dragCol];
        const x = node.container.x;
        const y = node.container.y;

        this.gaugeGfx.clear();

        const r = CONFIG.DRAG.GAUGE_RADIUS;
        const thickness = CONFIG.DRAG.GAUGE_THICKNESS;

        // Background ring
        this.gaugeGfx.lineStyle(thickness, 0x000000, 0.3);
        this.gaugeGfx.beginPath();
        this.gaugeGfx.arc(x, y, r, 0, Math.PI * 2, false);
        this.gaugeGfx.strokePath();

        // Foreground arc (shrinks clockwise from 12-o'clock)
        const color = this._gaugeColor(fraction);
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + fraction * Math.PI * 2;

        this.gaugeGfx.lineStyle(thickness + 1, color, 0.9);
        this.gaugeGfx.beginPath();
        this.gaugeGfx.arc(x, y, r, startAngle, endAngle, false);
        this.gaugeGfx.strokePath();
    }

    /** @private Colour shifts green → yellow → red as time runs out. */
    _gaugeColor(fraction) {
        if (fraction > 0.6) return 0x00FF88;
        if (fraction > 0.3) return 0xFFDD00;
        return 0xFF3333;
    }

    // ----------------------------------------------------------
    // End drag
    // ----------------------------------------------------------

    /** @private */
    _endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;

        // Deselect and snap back to cell centre
        const node = this.board.nodes[this.dragRow][this.dragCol];
        node.deselect();
        const pos = this.board.getCellCenter(this.dragRow, this.dragCol);
        node.setPosition(pos.x, pos.y);

        // Hide gauge
        this.gaugeGfx.clear();
        this.gaugeGfx.setVisible(false);

        // Notify the scene
        this.scene.onDragEnd();
    }

    // ----------------------------------------------------------

    destroy() {
        this.scene.input.off('pointerdown', this._onDown, this);
        this.scene.input.off('pointermove', this._onMove, this);
        this.scene.input.off('pointerup', this._onUp, this);
        this.gaugeGfx.destroy();
    }
}
