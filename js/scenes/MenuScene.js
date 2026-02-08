import { CONFIG } from '../config.js';

// ============================================================
// MenuScene — mode selection screen
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
        }).setOrigin(0.5);

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
        }).setOrigin(0.5);

        // Mode buttons
        this._createModeCard(
            cx, 360,
            'DEMO MODE',
            'Free play — endless practice.\nNew orbs keep falling after matches.',
            0x2A6478,
            0x1E4D5C,
            () => this.scene.start('GameScene', { mode: 'demo' }),
        );

        this._createModeCard(
            cx, 560,
            'CLEAR MODE',
            'Clear every orb from the board!\nAll symbols appear in multiples of 3.\nNo new orbs spawn after matches.',
            0x6A3478,
            0x4E2458,
            () => this.scene.start('GameScene', { mode: 'clear' }),
        );

        // Footer
        this.add.text(cx, CONFIG.GAME.HEIGHT - 40, 'Drag orbs to match 3+ of the same color', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#555577',
        }).setOrigin(0.5);
    }

    /**
     * @private Create a clickable mode card.
     */
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

        // Hit area
        const hitArea = this.add.rectangle(x, y, w, h)
            .setInteractive({ useHandCursor: true })
            .setOrigin(0.5);
        hitArea.setFillStyle(0xFFFFFF, 0); // invisible

        hitArea.on('pointerover', () => {
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

        hitArea.on('pointerdown', onClick);
    }
}
