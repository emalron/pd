import { CONFIG } from '../config.js';
import { PlayerState } from '../roguelike/PlayerState.js';

// ============================================================
// MenuScene — mode selection screen with scrollable mode list
// ============================================================

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const cx = CONFIG.GAME.WIDTH / 2;

        // Title
        const title = this.add.text(cx, 120, 'PUZZLE &\nDRAGONS', {
            fontSize: '56px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#FFD700',
            stroke: '#8B6914',
            strokeThickness: 5,
            align: 'center',
            lineSpacing: 6,
        }).setOrigin(0.5).setDepth(10);

        this.tweens.add({
            targets: title,
            y: 130,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // Subtitle
        this.add.text(cx, 210, 'SELECT MODE', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#8888CC',
            letterSpacing: 4,
        }).setOrigin(0.5).setDepth(10);

        // --- Scroll region setup ---
        this._scrollTop = 250;
        this._scrollBottom = CONFIG.GAME.HEIGHT - 50;
        this._scrollHeight = this._scrollBottom - this._scrollTop;
        this._scrollY = 0;
        this._scrollVelocity = 0;
        this._isDragging = false;
        this._dragMoved = false;

        // Scroll container (all mode cards live here)
        this._scrollContainer = this.add.container(0, this._scrollTop);

        // Build mode cards
        const modes = this._getModes();
        const cardH = 140;
        const cardGap = 20;
        const padding = 15;

        modes.forEach((mode, i) => {
            const cardCenterY = padding + cardH / 2 + i * (cardH + cardGap);
            this._createModeCard(
                cx, cardCenterY,
                mode.title, mode.desc,
                mode.bgColor, mode.borderColor,
                mode.onClick,
            );
        });

        // Compute max scroll
        const contentHeight = padding * 2 + modes.length * cardH + (modes.length - 1) * cardGap;
        this._maxScroll = Math.max(0, contentHeight - this._scrollHeight);

        // Mask to clip content outside scroll region
        const maskGfx = this.make.graphics({ add: false });
        maskGfx.fillStyle(0xffffff);
        maskGfx.fillRect(0, this._scrollTop, CONFIG.GAME.WIDTH, this._scrollHeight);
        this._scrollContainer.setMask(maskGfx.createGeometryMask());

        // Input handling for scroll
        this._setupScrollInput();

        // Fade + chevron indicators
        this._createScrollIndicators(cx);

        // Footer
        this.add.text(cx, CONFIG.GAME.HEIGHT - 20, 'Drag orbs to match 3+ of the same color', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#555577',
        }).setOrigin(0.5).setDepth(10);
    }

    update() {
        // Momentum / inertia scrolling after finger lift
        if (!this._isDragging && Math.abs(this._scrollVelocity) > 0.5) {
            this._scrollVelocity *= 0.93;
            this._setScroll(this._scrollY + this._scrollVelocity);
        } else if (!this._isDragging) {
            this._scrollVelocity = 0;
        }
    }

    // --------------------------------------------------------
    // Mode definitions
    // --------------------------------------------------------

    _getModes() {
        const modes = [
            {
                title: 'ROGUELIKE',
                desc: 'Battle monsters across worlds!\nEarn gold, upgrade stats,\nand conquer the dungeons.',
                bgColor: 0x783434,
                borderColor: 0x5C1E1E,
                onClick: () => {
                    const playerState = new PlayerState();
                    this.scene.start('BattleScene', { playerState });
                },
            },
            {
                title: 'DEMO MODE',
                desc: 'Free play — endless practice.\nNew orbs keep falling after matches.',
                bgColor: 0x2A6478,
                borderColor: 0x1E4D5C,
                onClick: () => this.scene.start('GameScene', { mode: 'demo' }),
            },
            {
                title: 'CLEAR MODE',
                desc: 'Clear every orb from the board!\nAll symbols appear in multiples of 3.\nNo new orbs spawn after matches.',
                bgColor: 0x6A3478,
                borderColor: 0x4E2458,
                onClick: () => this.scene.start('GameScene', { mode: 'clear' }),
            },
        ];

        return modes;
    }

    // --------------------------------------------------------
    // Scroll input (drag + mouse wheel)
    // --------------------------------------------------------

    _setupScrollInput() {
        let dragStartY = 0;
        let dragStartScroll = 0;
        let lastPointerY = 0;

        this.input.on('pointerdown', (pointer) => {
            if (pointer.y < this._scrollTop || pointer.y > this._scrollBottom) return;
            this._isDragging = true;
            this._dragMoved = false;
            dragStartY = pointer.y;
            dragStartScroll = this._scrollY;
            lastPointerY = pointer.y;
            this._scrollVelocity = 0;
        });

        this.input.on('pointermove', (pointer) => {
            if (!this._isDragging) return;
            const dy = dragStartY - pointer.y;
            if (Math.abs(dy) > 8) this._dragMoved = true;

            // Track velocity for momentum
            this._scrollVelocity = lastPointerY - pointer.y;
            lastPointerY = pointer.y;

            this._setScroll(dragStartScroll + dy);
        });

        this.input.on('pointerup', () => {
            this._isDragging = false;
            // Reset on next frame so card pointerup handlers still see the flag
            this.time.delayedCall(0, () => { this._dragMoved = false; });
        });

        this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
            this._scrollVelocity = 0;
            this._setScroll(this._scrollY + deltaY * 0.5);
        });
    }

    _setScroll(value) {
        this._scrollY = Phaser.Math.Clamp(value, 0, this._maxScroll);
        this._scrollContainer.y = this._scrollTop - this._scrollY;
        this._updateIndicators();
    }

    // --------------------------------------------------------
    // Scroll indicators (edge fade + animated chevrons)
    // --------------------------------------------------------

    _createScrollIndicators(cx) {
        const bgColor = 0x1a1a2e; // matches CONFIG.GAME.BG_COLOR

        // Bottom fade gradient
        this._bottomFade = this.add.graphics().setDepth(5);
        this._drawFadeGradient(this._bottomFade, this._scrollBottom, 'bottom', bgColor);

        // Top fade gradient
        this._topFade = this.add.graphics().setDepth(5);
        this._drawFadeGradient(this._topFade, this._scrollTop, 'top', bgColor);

        // Bottom chevron
        this._bottomChevron = this.add.text(cx, this._scrollBottom - 14, '\u25BC  more  \u25BC', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#8888CC',
        }).setOrigin(0.5).setDepth(6);

        this.tweens.add({
            targets: this._bottomChevron,
            y: this._scrollBottom - 8,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // Top chevron
        this._topChevron = this.add.text(cx, this._scrollTop + 14, '\u25B2  more  \u25B2', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#8888CC',
        }).setOrigin(0.5).setDepth(6);

        this.tweens.add({
            targets: this._topChevron,
            y: this._scrollTop + 8,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        this._updateIndicators();
    }

    _drawFadeGradient(graphics, edgeY, side, color) {
        const h = 36;
        const steps = 9;
        const stepH = h / steps;

        graphics.clear();
        for (let i = 0; i < steps; i++) {
            // bottom: transparent at top → opaque at bottom
            // top:    opaque at top → transparent at bottom
            const alpha = side === 'bottom'
                ? i / (steps - 1)
                : 1 - i / (steps - 1);
            const y = side === 'bottom'
                ? edgeY - h + i * stepH
                : edgeY + i * stepH;
            graphics.fillStyle(color, alpha);
            graphics.fillRect(0, y, CONFIG.GAME.WIDTH, stepH + 1);
        }
    }

    _updateIndicators() {
        if (!this._bottomChevron) return;

        const nearBottom = this._scrollY >= this._maxScroll - 2;
        const nearTop = this._scrollY <= 2;
        const canScroll = this._maxScroll > 0;

        this._bottomChevron.setAlpha(canScroll && !nearBottom ? 0.8 : 0);
        this._bottomFade.setAlpha(canScroll && !nearBottom ? 1 : 0);

        this._topChevron.setAlpha(canScroll && !nearTop ? 0.8 : 0);
        this._topFade.setAlpha(canScroll && !nearTop ? 1 : 0);
    }

    // --------------------------------------------------------
    // Mode card builder
    // --------------------------------------------------------

    _createModeCard(x, y, title, desc, bgColor, borderColor, onClick) {
        const w = 420;
        const h = 140;
        const left = x - w / 2;
        const top = y - h / 2;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(bgColor, 0.7);
        bg.fillRoundedRect(left, top, w, h, 16);
        bg.lineStyle(2, borderColor, 1);
        bg.strokeRoundedRect(left, top, w, h, 16);

        // Title text
        const titleTxt = this.add.text(x, y - 30, title, {
            fontSize: '28px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5);

        // Description text
        const descTxt = this.add.text(x, y + 22, desc, {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#CCCCDD',
            align: 'center',
            lineSpacing: 3,
        }).setOrigin(0.5);

        // Invisible hit area
        const hitArea = this.add.rectangle(x, y, w, h)
            .setInteractive({ useHandCursor: true })
            .setOrigin(0.5);
        hitArea.setFillStyle(0xFFFFFF, 0);

        hitArea.on('pointerover', () => {
            if (this._dragMoved) return;
            bg.clear();
            bg.fillStyle(bgColor, 1);
            bg.fillRoundedRect(left, top, w, h, 16);
            bg.lineStyle(2, 0xFFFFFF, 0.6);
            bg.strokeRoundedRect(left, top, w, h, 16);
            titleTxt.setColor('#FFD700');
        });

        hitArea.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(bgColor, 0.7);
            bg.fillRoundedRect(left, top, w, h, 16);
            bg.lineStyle(2, borderColor, 1);
            bg.strokeRoundedRect(left, top, w, h, 16);
            titleTxt.setColor('#FFFFFF');
        });

        // Use pointerup + drag check so scroll drags don't trigger clicks
        hitArea.on('pointerup', (pointer) => {
            if (this._dragMoved) return;
            // Ignore clicks outside the visible scroll area
            if (pointer.y < this._scrollTop || pointer.y > this._scrollBottom) return;
            onClick();
        });

        // Add all elements to the scroll container
        this._scrollContainer.add([bg, titleTxt, descTxt, hitArea]);
    }
}
