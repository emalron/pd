import { CONFIG } from '../config.js';
import { Board } from '../board/Board.js';
import { DragController } from '../input/DragController.js';
import { CombatResolver } from '../roguelike/CombatResolver.js';
import { MONSTERS } from '../data/monsters.js';
import { WORLDS } from '../data/worlds.js';

// ============================================================
// BattleScene — puzzle + combat scene for roguelike mode.
//
// State machine:
//   INTRO → IDLE → DRAGGING → RESOLVING ⇄ FALLING → COMBAT_ANIM
//     → MONSTER_TURN → IDLE | REVIVE | GAME_OVER
//     → MONSTER_DEFEATED → INTRO | STAGE_CLEAR → UpgradeScene
// ============================================================

const State = Object.freeze({
    INTRO: 'intro',
    IDLE: 'idle',
    DRAGGING: 'dragging',
    RESOLVING: 'resolving',
    FALLING: 'falling',
    COMBAT_ANIM: 'combat_anim',
    MONSTER_TURN: 'monster_turn',
    MONSTER_DEFEATED: 'monster_defeated',
    GAME_OVER: 'game_over',
    VICTORY: 'victory',
});

export class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    // ----------------------------------------------------------
    // Phaser lifecycle
    // ----------------------------------------------------------

    init(data) {
        this.playerState = data.playerState;
        this.state = State.INTRO;
        this.totalCombo = 0;
        this.turnGroups = [];

        // Current monster runtime state
        this.currentMonster = null;
        this.monsterHp = 0;
        this.monsterTurnCounter = 0;
    }

    create() {
        // Board uses 'demo' mode (orbs refill after matches)
        this.board = new Board(this, 'demo');
        this.drag = new DragController(this, this.board);

        this._createUI();
        this._startMonsterIntro();
    }

    update() {
        this.drag.update();
    }

    // ----------------------------------------------------------
    // DragController interface
    // ----------------------------------------------------------

    canStartDrag() {
        return this.state === State.IDLE;
    }

    getDragTimeout() {
        return this.playerState.getEffectiveTimeout();
    }

    onDragStart() {
        this.state = State.DRAGGING;
        this.totalCombo = 0;
        this.turnGroups = [];
        this.comboLabel.setText('').setAlpha(1);
    }

    async onDragEnd() {
        this.state = State.RESOLVING;
        await this._resolveLoop();
        await this._executeCombatPhase();
    }

    // ----------------------------------------------------------
    // Core resolve loop (same pattern as GameScene)
    // ----------------------------------------------------------

    async _resolveLoop() {
        while (true) {
            const groups = this.board.findMatches();
            if (groups.length === 0) break;

            // Accumulate all groups for combat
            this.turnGroups.push(...groups);

            this.totalCombo = await this.board.resolveMatches(groups, this.totalCombo);
            this._updateComboUI();

            this.state = State.FALLING;
            await this.board.applyGravity();
            this.state = State.RESOLVING;

            await this._delay(150);
        }
    }

    // ----------------------------------------------------------
    // Combat phase
    // ----------------------------------------------------------

    async _executeCombatPhase() {
        this.state = State.COMBAT_ANIM;

        const { attackGroups, recoveryGroups } = CombatResolver.classifyGroups(this.turnGroups);

        // Recovery
        if (recoveryGroups.length > 0) {
            const { totalRecovery } = CombatResolver.calculateRecovery(this.playerState, recoveryGroups);
            if (totalRecovery > 0) {
                this.playerState.heal(totalRecovery);
                await this._showDamageNumber(`+${totalRecovery}`, this.playerHpBar.x, this.playerHpBar.y - 20, 0x44FF44);
                this._updatePlayerUI();
            }
        }

        // Attack
        if (attackGroups.length > 0) {
            const { finalDamage } = CombatResolver.calculateAttackDamage(
                this.playerState, this.currentMonster, attackGroups, this.totalCombo);

            if (finalDamage > 0) {
                this.monsterHp = Math.max(0, this.monsterHp - finalDamage);
                await this._showDamageNumber(`${finalDamage}`, this.monsterVisual.x, this.monsterVisual.y, 0xFF4444);
                this._flashMonster();
                this._updateMonsterUI();
            }
        }

        // Fade combo label
        if (this.totalCombo > 0) {
            await this._delay(400);
            this.tweens.add({ targets: this.comboLabel, alpha: 0, duration: 300 });
        }

        // Check monster death
        if (this.monsterHp <= 0) {
            await this._handleMonsterDefeated();
            return;
        }

        // Monster turn
        await this._executeMonsterTurn();
    }

    async _executeMonsterTurn() {
        this.state = State.MONSTER_TURN;

        this.monsterTurnCounter--;
        this._updateTurnUI();

        if (this.monsterTurnCounter <= 0) {
            // Monster attacks
            const damage = CombatResolver.calculateMonsterDamage(this.currentMonster, this.playerState);
            this.playerState.hp = Math.max(0, this.playerState.hp - damage);
            await this._monsterAttackAnim(damage);
            this._updatePlayerUI();

            // Reset turn counter
            this.monsterTurnCounter = this.currentMonster.turnCount;
            this._updateTurnUI();

            // Check player death
            if (this.playerState.isDead()) {
                if (this.playerState.tryRevive()) {
                    await this._showReviveAnim();
                    this._updatePlayerUI();
                } else {
                    this._showGameOver();
                    return;
                }
            }
        }

        this.state = State.IDLE;
    }

    async _handleMonsterDefeated() {
        this.state = State.MONSTER_DEFEATED;

        // Gold reward
        this.playerState.gold += this.currentMonster.gold;
        await this._showDamageNumber(`+${this.currentMonster.gold}G`, this.monsterVisual.x, this.monsterVisual.y - 40, 0xFFD700);

        // Destroy monster visual
        await this._monsterDeathAnim();
        this._updatePlayerUI();

        // Advance to next monster
        this.playerState.monsterIdx++;

        const world = WORLDS[this.playerState.worldIdx];
        const stage = world.stages[this.playerState.stageIdx];

        if (this.playerState.monsterIdx < stage.monsters.length) {
            // Next monster in same stage
            await this._delay(500);
            this._startMonsterIntro();
        } else {
            // Stage clear
            this.playerState.monsterIdx = 0;
            this.playerState.stageIdx++;

            if (this.playerState.stageIdx < world.stages.length) {
                // Next stage — go to upgrade shop
                await this._delay(500);
                this.scene.start('UpgradeScene', { playerState: this.playerState });
            } else {
                // World clear — check next world
                this.playerState.stageIdx = 0;
                this.playerState.worldIdx++;

                if (this.playerState.worldIdx < WORLDS.length) {
                    await this._delay(500);
                    this.scene.start('UpgradeScene', { playerState: this.playerState });
                } else {
                    // All worlds cleared!
                    this._showVictory();
                }
            }
        }
    }

    // ----------------------------------------------------------
    // Monster intro
    // ----------------------------------------------------------

    _startMonsterIntro() {
        this.state = State.INTRO;

        const world = WORLDS[this.playerState.worldIdx];
        const stage = world.stages[this.playerState.stageIdx];
        const monsterId = stage.monsters[this.playerState.monsterIdx];
        this.currentMonster = { ...MONSTERS[monsterId] };
        this.monsterHp = this.currentMonster.hp;
        this.monsterTurnCounter = this.currentMonster.turnCount;

        this._updateMonsterUI();
        this._updateTurnUI();
        this._updatePlayerUI();
        this._updateProgressUI();
        this._createMonsterVisual();

        // Intro animation
        this.monsterVisual.setScale(0);
        this.tweens.add({
            targets: this.monsterVisual,
            scaleX: this.currentMonster.scale,
            scaleY: this.currentMonster.scale,
            duration: 400,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.state = State.IDLE;
            },
        });
    }

    // ----------------------------------------------------------
    // UI Creation
    // ----------------------------------------------------------

    _createUI() {
        const cx = CONFIG.GAME.WIDTH / 2;

        // --- Monster area (top) ---
        this.turnLabel = this.add.text(20, 18, '', {
            fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#AAAACC',
        }).setDepth(10);

        this.monsterNameLabel = this.add.text(cx, 18, '', {
            fontSize: '18px', fontFamily: 'Arial Black, sans-serif',
            color: '#FFFFFF', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0).setDepth(10);

        // Monster HP bar
        this.monsterHpBarBg = this.add.graphics().setDepth(9);
        this.monsterHpBarFg = this.add.graphics().setDepth(10);
        this.monsterHpLabel = this.add.text(cx, 56, '', {
            fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#FFFFFF',
        }).setOrigin(0.5, 0).setDepth(10);

        this._drawHpBarBg(this.monsterHpBarBg, 60, 45, 420, 14);

        // Monster visual placeholder
        this.monsterVisual = this.add.graphics().setDepth(5);

        // Combo label (center, above board)
        this.comboLabel = this.add.text(cx, this.board.originY - 30, '', {
            fontSize: '36px', fontFamily: 'Arial Black, sans-serif',
            color: '#FFFFFF', stroke: '#000000', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(2000);

        // --- Player area (bottom) ---
        const boardBottom = this.board.originY + this.board.rows * this.board.cellSize + 12;

        // Player HP bar
        this.playerHpBar = { x: cx, y: boardBottom + 10 };
        this.playerHpBarBg = this.add.graphics().setDepth(9);
        this.playerHpBarFg = this.add.graphics().setDepth(10);
        this.playerHpLabel = this.add.text(cx, boardBottom + 18, '', {
            fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#FFFFFF',
        }).setOrigin(0.5, 0).setDepth(10);
        this._drawHpBarBg(this.playerHpBarBg, 60, boardBottom + 5, 420, 14);

        // Player stats
        this.playerStatsLabel = this.add.text(cx, boardBottom + 38, '', {
            fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#AAAACC',
        }).setOrigin(0.5, 0).setDepth(10);

        // Progress label
        this.progressLabel = this.add.text(20, boardBottom + 58, '', {
            fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#888899',
        }).setDepth(10);

        // Menu button
        this._createMenuButton(CONFIG.GAME.WIDTH - 60, boardBottom + 62);
    }

    _createMenuButton(x, y) {
        const w = 80;
        const h = 28;

        const bg = this.add.graphics().setDepth(10);
        bg.fillStyle(0x333355, 0.8);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
        bg.lineStyle(1, 0x555577, 1);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);

        const label = this.add.text(x, y, 'MENU', {
            fontSize: '12px', fontFamily: 'Arial Black, sans-serif', color: '#AAAACC',
        }).setOrigin(0.5).setDepth(10);

        const hit = this.add.rectangle(x, y, w, h)
            .setInteractive({ useHandCursor: true })
            .setFillStyle(0xFFFFFF, 0).setDepth(11);

        hit.on('pointerover', () => label.setColor('#FFD700'));
        hit.on('pointerout', () => label.setColor('#AAAACC'));
        hit.on('pointerdown', () => this.scene.start('MenuScene'));
    }

    // ----------------------------------------------------------
    // UI Updates
    // ----------------------------------------------------------

    _updateComboUI() {
        this.comboLabel.setText(`${this.totalCombo} COMBO!`);
    }

    _updateMonsterUI() {
        if (!this.currentMonster) return;

        this.monsterNameLabel.setText(this.currentMonster.name);

        const frac = Math.max(0, this.monsterHp / this.currentMonster.hp);
        this._drawHpBarFg(this.monsterHpBarFg, 60, 45, 420, 14, frac, 0xE84545);
        this.monsterHpLabel.setText(`${this.monsterHp} / ${this.currentMonster.hp}`);
    }

    _updateTurnUI() {
        if (!this.currentMonster) return;
        this.turnLabel.setText(`Turn: ${this.monsterTurnCounter}`);
    }

    _updatePlayerUI() {
        const ps = this.playerState;
        const frac = Math.max(0, ps.hp / ps.maxHp);
        this._drawHpBarFg(this.playerHpBarFg, 60, this.playerHpBar.y - 5, 420, 14, frac, 0x44BB44);
        this.playerHpLabel.setText(`${ps.hp} / ${ps.maxHp}`);
        this.playerStatsLabel.setText(
            `ATK:${ps.atk}  DEF:${ps.def}  RCV:${ps.rcv}  Gold:${ps.gold}`
        );
    }

    _updateProgressUI() {
        const ps = this.playerState;
        const world = WORLDS[ps.worldIdx];
        const stage = world.stages[ps.stageIdx];
        const monsterNum = ps.monsterIdx + 1;
        const totalMonsters = stage.monsters.length;
        this.progressLabel.setText(
            `${world.name} - ${stage.name}  [${monsterNum}/${totalMonsters}]`
        );
    }

    // ----------------------------------------------------------
    // HP bar drawing
    // ----------------------------------------------------------

    _drawHpBarBg(gfx, x, y, w, h) {
        gfx.clear();
        gfx.fillStyle(0x222244, 0.8);
        gfx.fillRoundedRect(x, y, w, h, 4);
        gfx.lineStyle(1, 0x444466, 1);
        gfx.strokeRoundedRect(x, y, w, h, 4);
    }

    _drawHpBarFg(gfx, x, y, w, h, fraction, color) {
        gfx.clear();
        const fillW = Math.max(0, w * fraction);
        if (fillW > 0) {
            gfx.fillStyle(color, 0.9);
            gfx.fillRoundedRect(x, y, fillW, h, 4);
        }
    }

    // ----------------------------------------------------------
    // Monster visual
    // ----------------------------------------------------------

    _createMonsterVisual() {
        this.monsterVisual.clear();

        const cx = CONFIG.GAME.WIDTH / 2;
        const cy = 150;
        const r = 40 * this.currentMonster.scale;
        const color = this.currentMonster.color;

        // All draw commands in local space (0,0 = monster center)
        this.monsterVisual.fillStyle(color, 1);
        this.monsterVisual.fillCircle(0, 0, r);

        this.monsterVisual.fillStyle(0x000000, 0.15);
        this.monsterVisual.fillEllipse(0, r + 5, r * 1.4, 10);

        this.monsterVisual.fillStyle(0xFFFFFF, 0.9);
        this.monsterVisual.fillCircle(-r * 0.3, -r * 0.15, r * 0.2);
        this.monsterVisual.fillCircle(r * 0.3, -r * 0.15, r * 0.2);
        this.monsterVisual.fillStyle(0x000000, 1);
        this.monsterVisual.fillCircle(-r * 0.25, -r * 0.12, r * 0.08);
        this.monsterVisual.fillCircle(r * 0.35, -r * 0.12, r * 0.08);

        // Position in world space (also used by damage numbers / flash)
        this.monsterVisual.x = cx;
        this.monsterVisual.y = cy;
    }

    // ----------------------------------------------------------
    // Animations
    // ----------------------------------------------------------

    _flashMonster() {
        const flash = this.add.graphics().setDepth(6);
        flash.fillStyle(0xFFFFFF, 0.5);
        flash.fillCircle(this.monsterVisual.x, this.monsterVisual.y,
            45 * this.currentMonster.scale);

        this.tweens.add({
            targets: flash, alpha: 0, duration: 200,
            onComplete: () => flash.destroy(),
        });
    }

    async _showDamageNumber(text, x, y, color) {
        const colorStr = '#' + color.toString(16).padStart(6, '0');
        const txt = this.add.text(x, y, text, {
            fontSize: '28px', fontFamily: 'Arial Black, sans-serif',
            color: colorStr, stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(3000).setScale(0);

        await new Promise(resolve => {
            this.tweens.add({
                targets: txt, scaleX: 1.2, scaleY: 1.2,
                duration: 150, ease: 'Back.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: txt, y: y - 50, alpha: 0, scaleX: 1, scaleY: 1,
                        duration: 500, ease: 'Power2',
                        onComplete: () => { txt.destroy(); resolve(); },
                    });
                },
            });
        });
    }

    async _monsterAttackAnim(damage) {
        // Screen shake
        this.cameras.main.shake(200, 0.01);

        // Flash red on player area
        const flash = this.add.rectangle(
            CONFIG.GAME.WIDTH / 2, CONFIG.GAME.HEIGHT / 2,
            CONFIG.GAME.WIDTH, CONFIG.GAME.HEIGHT,
            0xFF0000, 0.15
        ).setDepth(2500);

        await this._delay(200);
        flash.destroy();

        await this._showDamageNumber(`-${damage}`, this.playerHpBar.x, this.playerHpBar.y - 20, 0xFF4444);
    }

    async _monsterDeathAnim() {
        const cx = this.monsterVisual.x;
        const cy = this.monsterVisual.y;

        // Particles (simple circles)
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const p = this.add.circle(cx, cy, 6, this.currentMonster.color).setDepth(6);
            this.tweens.add({
                targets: p,
                x: cx + Math.cos(angle) * 60,
                y: cy + Math.sin(angle) * 60,
                alpha: 0, scale: 0,
                duration: 400, ease: 'Power2',
                onComplete: () => p.destroy(),
            });
        }

        this.monsterVisual.clear();
        await this._delay(400);
    }

    async _showReviveAnim() {
        const cx = CONFIG.GAME.WIDTH / 2;
        const cy = CONFIG.GAME.HEIGHT / 2;

        const txt = this.add.text(cx, cy, 'REVIVE!', {
            fontSize: '48px', fontFamily: 'Arial Black, sans-serif',
            color: '#44FF44', stroke: '#000000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(3500).setScale(0);

        await new Promise(resolve => {
            this.tweens.add({
                targets: txt, scaleX: 1, scaleY: 1,
                duration: 400, ease: 'Back.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: txt, alpha: 0,
                        duration: 600, delay: 500,
                        onComplete: () => { txt.destroy(); resolve(); },
                    });
                },
            });
        });
    }

    // ----------------------------------------------------------
    // Game Over / Victory
    // ----------------------------------------------------------

    _showGameOver() {
        this.state = State.GAME_OVER;
        const cx = CONFIG.GAME.WIDTH / 2;
        const cy = CONFIG.GAME.HEIGHT / 2;

        const overlay = this.add.rectangle(cx, cy,
            CONFIG.GAME.WIDTH, CONFIG.GAME.HEIGHT, 0x000000, 0.7).setDepth(3000);

        const txt = this.add.text(cx, cy - 60, 'GAME\nOVER', {
            fontSize: '64px', fontFamily: 'Arial Black, sans-serif',
            color: '#FF4444', stroke: '#000000', strokeThickness: 6,
            align: 'center', lineSpacing: 4,
        }).setOrigin(0.5).setDepth(3001).setScale(0);

        this.tweens.add({
            targets: txt, scaleX: 1, scaleY: 1,
            duration: 500, ease: 'Back.easeOut',
        });

        // Stats summary
        this.add.text(cx, cy + 40, `Gold earned: ${this.playerState.gold}`, {
            fontSize: '20px', fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
        }).setOrigin(0.5).setDepth(3001);

        const world = WORLDS[Math.min(this.playerState.worldIdx, WORLDS.length - 1)];
        this.add.text(cx, cy + 70, `Reached: ${world.name}`, {
            fontSize: '16px', fontFamily: 'Arial, sans-serif',
            color: '#AAAACC',
        }).setOrigin(0.5).setDepth(3001);

        // Buttons
        this._createOverlayButton(cx - 90, cy + 130, 'RETRY', () => {
            this.scene.start('MenuScene');
        });
        this._createOverlayButton(cx + 90, cy + 130, 'MENU', () => {
            this.scene.start('MenuScene');
        });
    }

    _showVictory() {
        this.state = State.VICTORY;
        const cx = CONFIG.GAME.WIDTH / 2;
        const cy = CONFIG.GAME.HEIGHT / 2;

        const overlay = this.add.rectangle(cx, cy,
            CONFIG.GAME.WIDTH, CONFIG.GAME.HEIGHT, 0x000000, 0.7).setDepth(3000);

        const txt = this.add.text(cx, cy - 60, 'VICTORY!', {
            fontSize: '56px', fontFamily: 'Arial Black, sans-serif',
            color: '#FFD700', stroke: '#000000', strokeThickness: 6,
            align: 'center',
        }).setOrigin(0.5).setDepth(3001).setScale(0);

        this.tweens.add({
            targets: txt, scaleX: 1, scaleY: 1,
            duration: 500, ease: 'Back.easeOut',
        });

        this.add.text(cx, cy + 30, 'All worlds cleared!', {
            fontSize: '20px', fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
        }).setOrigin(0.5).setDepth(3001);

        this.add.text(cx, cy + 60, `Total Gold: ${this.playerState.gold}`, {
            fontSize: '18px', fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
        }).setOrigin(0.5).setDepth(3001);

        this._createOverlayButton(cx, cy + 130, 'MENU', () => {
            this.scene.start('MenuScene');
        });
    }

    _createOverlayButton(x, y, label, onClick) {
        const w = 140;
        const h = 44;

        const bg = this.add.graphics().setDepth(3001);
        bg.fillStyle(0x444466, 0.9);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
        bg.lineStyle(1, 0x8888AA, 1);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);

        const txt = this.add.text(x, y, label, {
            fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#CCCCEE',
        }).setOrigin(0.5).setDepth(3001);

        const hit = this.add.rectangle(x, y, w, h)
            .setInteractive({ useHandCursor: true })
            .setFillStyle(0xFFFFFF, 0).setDepth(3002);

        hit.on('pointerover', () => txt.setColor('#FFD700'));
        hit.on('pointerout', () => txt.setColor('#CCCCEE'));
        hit.on('pointerdown', onClick);
    }

    // ----------------------------------------------------------
    // Utility
    // ----------------------------------------------------------

    _delay(ms) {
        return new Promise(resolve => this.time.delayedCall(ms, resolve));
    }
}
