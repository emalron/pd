import { CONFIG } from '../config.js';
import { UPGRADES } from '../data/upgrades.js';
import { WORLDS } from '../data/worlds.js';

// ============================================================
// UpgradeScene — upgrade shop between stages.
// Uses the same scroll pattern as MenuScene.
// ============================================================

export class UpgradeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UpgradeScene' });
    }

    init(data) {
        this.playerState = data.playerState;
    }

    create() {
        const cx = CONFIG.GAME.WIDTH / 2;

        // Title
        this.add.text(cx, 30, 'UPGRADE SHOP', {
            fontSize: '32px', fontFamily: 'Arial Black, sans-serif',
            color: '#FFD700', stroke: '#8B6914', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(10);

        // Gold display
        this.goldLabel = this.add.text(cx, 70, `Gold: ${this.playerState.gold}`, {
            fontSize: '22px', fontFamily: 'Arial Black, sans-serif',
            color: '#FFD700',
        }).setOrigin(0.5).setDepth(10);

        // Current stats
        const ps = this.playerState;
        this.add.text(cx, 100, `HP:${ps.hp}/${ps.maxHp}  ATK:${ps.atk}  DEF:${ps.def}  RCV:${ps.rcv}`, {
            fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#AAAACC',
        }).setOrigin(0.5).setDepth(10);

        // Next stage info
        const nextInfo = this._getNextStageInfo();
        this.add.text(cx, 125, nextInfo, {
            fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#8888AA',
        }).setOrigin(0.5).setDepth(10);

        // --- Scroll region for upgrade cards ---
        this._scrollTop = 155;
        this._scrollBottom = CONFIG.GAME.HEIGHT - 90;
        this._scrollHeight = this._scrollBottom - this._scrollTop;
        this._scrollY = 0;
        this._scrollVelocity = 0;
        this._isDragging = false;
        this._dragMoved = false;

        this._scrollContainer = this.add.container(0, this._scrollTop);

        // Build upgrade cards
        const cardH = 90;
        const cardGap = 12;
        const padding = 10;

        UPGRADES.forEach((upg, i) => {
            const cardY = padding + cardH / 2 + i * (cardH + cardGap);
            this._createUpgradeCard(cx, cardY, upg, cardH);
        });

        // Compute max scroll
        const contentHeight = padding * 2 + UPGRADES.length * cardH + (UPGRADES.length - 1) * cardGap;
        this._maxScroll = Math.max(0, contentHeight - this._scrollHeight);

        // Mask
        const maskGfx = this.make.graphics({ add: false });
        maskGfx.fillStyle(0xffffff);
        maskGfx.fillRect(0, this._scrollTop, CONFIG.GAME.WIDTH, this._scrollHeight);
        this._scrollContainer.setMask(maskGfx.createGeometryMask());

        // Scroll input
        this._setupScrollInput();

        // Continue button
        this._createContinueButton(cx, CONFIG.GAME.HEIGHT - 45);
    }

    update() {
        if (!this._isDragging && Math.abs(this._scrollVelocity) > 0.5) {
            this._scrollVelocity *= 0.93;
            this._setScroll(this._scrollY + this._scrollVelocity);
        } else if (!this._isDragging) {
            this._scrollVelocity = 0;
        }
    }

    // ----------------------------------------------------------
    // Next stage info
    // ----------------------------------------------------------

    _getNextStageInfo() {
        const ps = this.playerState;
        if (ps.worldIdx >= WORLDS.length) return 'All worlds cleared!';
        const world = WORLDS[ps.worldIdx];
        if (ps.stageIdx >= world.stages.length) return 'World cleared!';
        const stage = world.stages[ps.stageIdx];
        return `Next: ${world.name} - ${stage.name}`;
    }

    // ----------------------------------------------------------
    // Upgrade card
    // ----------------------------------------------------------

    _createUpgradeCard(x, y, upgDef, cardH) {
        const w = 440;
        const h = cardH;
        const left = x - w / 2;
        const top = y - h / 2;

        const ps = this.playerState;
        const level = ps.upgradeLevels[upgDef.id] || 0;
        const canBuy = ps.canPurchaseUpgrade(upgDef);
        const cost = ps.getUpgradeCost(upgDef);
        const maxed = upgDef.maxLevel !== -1 && level >= upgDef.maxLevel;

        const bgColor = canBuy ? 0x2A5A3A : (maxed ? 0x3A3A5A : 0x3A3A4A);
        const borderColor = canBuy ? 0x44AA55 : 0x555566;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(bgColor, 0.8);
        bg.fillRoundedRect(left, top, w, h, 12);
        bg.lineStyle(2, borderColor, 1);
        bg.strokeRoundedRect(left, top, w, h, 12);

        // Name + level
        const levelStr = maxed ? ' (MAX)' : ` Lv.${level}`;
        const nameText = this.add.text(left + 15, y - 18, upgDef.name + levelStr, {
            fontSize: '18px', fontFamily: 'Arial Black, sans-serif',
            color: canBuy ? '#FFFFFF' : '#888899',
            stroke: '#000000', strokeThickness: 2,
        });

        // Description
        const descText = this.add.text(left + 15, y + 8, upgDef.desc, {
            fontSize: '12px', fontFamily: 'Arial, sans-serif',
            color: '#AAAABB',
        });

        // Cost
        const costStr = maxed ? 'MAXED' : `${cost}G`;
        const costColor = canBuy ? '#FFD700' : (maxed ? '#8888AA' : '#AA6666');
        const costText = this.add.text(left + w - 15, y, costStr, {
            fontSize: '18px', fontFamily: 'Arial Black, sans-serif',
            color: costColor, stroke: '#000000', strokeThickness: 2,
        }).setOrigin(1, 0.5);

        // Hit area
        const hitArea = this.add.rectangle(x, y, w, h)
            .setInteractive({ useHandCursor: canBuy })
            .setOrigin(0.5)
            .setFillStyle(0xFFFFFF, 0);

        if (canBuy) {
            hitArea.on('pointerover', () => {
                if (this._dragMoved) return;
                bg.clear();
                bg.fillStyle(0x3A7A4A, 1);
                bg.fillRoundedRect(left, top, w, h, 12);
                bg.lineStyle(2, 0xFFFFFF, 0.6);
                bg.strokeRoundedRect(left, top, w, h, 12);
            });

            hitArea.on('pointerout', () => {
                bg.clear();
                bg.fillStyle(bgColor, 0.8);
                bg.fillRoundedRect(left, top, w, h, 12);
                bg.lineStyle(2, borderColor, 1);
                bg.strokeRoundedRect(left, top, w, h, 12);
            });

            hitArea.on('pointerup', (pointer) => {
                if (this._dragMoved) return;
                if (pointer.y < this._scrollTop || pointer.y > this._scrollBottom) return;
                if (this.playerState.purchaseUpgrade(upgDef)) {
                    // Restart scene to refresh all cards
                    this.scene.restart({ playerState: this.playerState });
                }
            });
        }

        this._scrollContainer.add([bg, nameText, descText, costText, hitArea]);
    }

    // ----------------------------------------------------------
    // Continue button
    // ----------------------------------------------------------

    _createContinueButton(x, y) {
        const w = 240;
        const h = 50;

        const bg = this.add.graphics().setDepth(10);
        bg.fillStyle(0x2A6478, 0.9);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
        bg.lineStyle(2, 0x4488AA, 1);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);

        const label = this.add.text(x, y, 'CONTINUE', {
            fontSize: '22px', fontFamily: 'Arial Black, sans-serif',
            color: '#FFFFFF', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(10);

        const hit = this.add.rectangle(x, y, w, h)
            .setInteractive({ useHandCursor: true })
            .setFillStyle(0xFFFFFF, 0).setDepth(11);

        hit.on('pointerover', () => label.setColor('#FFD700'));
        hit.on('pointerout', () => label.setColor('#FFFFFF'));
        hit.on('pointerdown', () => {
            this.scene.start('BattleScene', { playerState: this.playerState });
        });
    }

    // ----------------------------------------------------------
    // Scroll (same pattern as MenuScene)
    // ----------------------------------------------------------

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
            this._scrollVelocity = lastPointerY - pointer.y;
            lastPointerY = pointer.y;
            this._setScroll(dragStartScroll + dy);
        });

        this.input.on('pointerup', () => {
            this._isDragging = false;
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
    }
}
