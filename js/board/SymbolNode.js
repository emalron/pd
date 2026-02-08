import { CONFIG } from '../config.js';

// ============================================================
// SymbolNode — visual representation of a single orb/symbol.
//
// EXTENSIBILITY (switching to sprites):
//   Override `createVisual(typeId)` in a subclass to return
//   a Phaser.GameObjects.Sprite instead of Graphics.
//   Everything else (selection, animations) works the same.
// ============================================================

export class SymbolNode {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} typeId  index into CONFIG.SYMBOLS
     * @param {number} x       world x
     * @param {number} y       world y
     */
    constructor(scene, typeId, x, y) {
        this.scene = scene;
        this.typeId = typeId;
        this.isSelected = false;
        this._glowTween = null;

        this.container = scene.add.container(x, y);

        // Selection glow — sits behind the orb
        this.selectionGlow = this._createSelectionGlow();
        this.selectionGlow.setVisible(false);
        this.container.add(this.selectionGlow);

        // Main visual (circle for now; override createVisual for sprites)
        this.visual = this.createVisual(typeId);
        this.container.add(this.visual);
    }

    // ----------------------------------------------------------
    // Visual creation (override for sprites)
    // ----------------------------------------------------------

    /**
     * Build the orb graphic. Override this method and return a
     * Sprite or Image to replace circles with sprite-based orbs.
     * @param {number} typeId
     * @returns {Phaser.GameObjects.Graphics}
     */
    createVisual(typeId) {
        const sym = CONFIG.SYMBOLS[typeId];
        const r = CONFIG.ORB.RADIUS;
        const g = this.scene.add.graphics();

        // Drop shadow
        g.fillStyle(0x000000, 0.25);
        g.fillCircle(2, 3, r);

        // Main orb body
        g.fillStyle(sym.color, 1);
        g.fillCircle(0, 0, r);

        // Border
        g.lineStyle(2.5, sym.stroke, 1);
        g.strokeCircle(0, 0, r - 1);

        // Glossy highlight
        g.fillStyle(0xFFFFFF, 0.18);
        g.fillCircle(-r * 0.2, -r * 0.25, r * 0.5);

        // Specular dot
        g.fillStyle(0xFFFFFF, 0.4);
        g.fillCircle(-r * 0.28, -r * 0.32, r * 0.12);

        return g;
    }

    /** @private */
    _createSelectionGlow() {
        const g = this.scene.add.graphics();
        const r = CONFIG.ORB.RADIUS + 8;

        g.fillStyle(0xFFFFFF, 0.12);
        g.fillCircle(0, 0, r + 5);

        g.lineStyle(3, 0xFFFFFF, 0.7);
        g.strokeCircle(0, 0, r);

        return g;
    }

    // ----------------------------------------------------------
    // Selection
    // ----------------------------------------------------------

    select() {
        if (this.isSelected) return;
        this.isSelected = true;
        this.selectionGlow.setVisible(true);
        this.container.setScale(CONFIG.ORB.SELECTED_SCALE);
        this.container.setDepth(1000);

        this._glowTween = this.scene.tweens.add({
            targets: this.selectionGlow,
            alpha: { from: 1, to: 0.4 },
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    deselect() {
        if (!this.isSelected) return;
        this.isSelected = false;
        this.selectionGlow.setVisible(false);
        this.container.setScale(1);
        this.container.setDepth(0);

        if (this._glowTween) {
            this._glowTween.stop();
            this._glowTween = null;
        }
    }

    // ----------------------------------------------------------
    // Position helpers
    // ----------------------------------------------------------

    setPosition(x, y) {
        this.container.setPosition(x, y);
    }

    getPosition() {
        return { x: this.container.x, y: this.container.y };
    }

    // ----------------------------------------------------------
    // Animations (all return Promises)
    // ----------------------------------------------------------

    /** Smooth tween to (x, y) — used during drag swaps. */
    animateMoveTo(x, y, duration) {
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this.container,
                x, y,
                duration,
                ease: 'Power2',
                onComplete: resolve,
            });
        });
    }

    /** Gravity fall with bounce at the end. */
    animateFallTo(x, y, duration) {
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this.container,
                x, y,
                duration,
                ease: 'Bounce.easeOut',
                onComplete: resolve,
            });
        });
    }

    /** Flash → shrink → fade (played when matched). */
    animateMatch() {
        return new Promise(resolve => {
            // 1. Quick flash (scale up)
            this.scene.tweens.add({
                targets: this.container,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: CONFIG.ANIM.MATCH_FLASH_MS,
                yoyo: true,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    // 2. Shrink + fade out
                    this.scene.tweens.add({
                        targets: this.container,
                        scaleX: 0,
                        scaleY: 0,
                        alpha: 0,
                        duration: CONFIG.ANIM.MATCH_DISAPPEAR_MS,
                        ease: 'Back.easeIn',
                        onComplete: resolve,
                    });
                },
            });
        });
    }

    // ----------------------------------------------------------

    destroy() {
        if (this._glowTween) this._glowTween.stop();
        this.container.destroy();
    }
}
