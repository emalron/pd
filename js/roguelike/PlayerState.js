import { CONFIG } from '../config.js';

// ============================================================
// PlayerState — per-run runtime state for roguelike mode.
// Created at run start, passed between scenes via scene data.
// ============================================================

export class PlayerState {
    constructor() {
        const r = CONFIG.ROGUELIKE;
        this.maxHp = r.STARTING_HP;
        this.hp = r.STARTING_HP;
        this.atk = r.STARTING_ATK;
        this.def = r.STARTING_DEF;
        this.rcv = r.STARTING_RCV;
        this.gold = 0;
        this.revives = 0;
        this.bonusTimeoutMs = 0;

        // Progress tracking
        this.worldIdx = 0;
        this.stageIdx = 0;
        this.monsterIdx = 0;

        // Upgrade levels: { [upgradeId]: count }
        this.upgradeLevels = {};
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    takeDamage(rawDamage) {
        const actual = Math.max(1, rawDamage - this.def);
        this.hp = Math.max(0, this.hp - actual);
        return actual;
    }

    isDead() {
        return this.hp <= 0;
    }

    tryRevive() {
        if (this.revives > 0) {
            this.revives--;
            this.hp = this.maxHp;
            return true;
        }
        return false;
    }

    getEffectiveTimeout() {
        return CONFIG.DRAG.TIMEOUT_MS + this.bonusTimeoutMs;
    }

    getUpgradeCost(upgradeDef) {
        const level = this.upgradeLevels[upgradeDef.id] || 0;
        return Math.floor(upgradeDef.baseCost * Math.pow(upgradeDef.costScale, level));
    }

    canPurchaseUpgrade(upgradeDef) {
        const level = this.upgradeLevels[upgradeDef.id] || 0;
        if (upgradeDef.maxLevel !== -1 && level >= upgradeDef.maxLevel) return false;
        return this.gold >= this.getUpgradeCost(upgradeDef);
    }

    purchaseUpgrade(upgradeDef) {
        if (!this.canPurchaseUpgrade(upgradeDef)) return false;

        const cost = this.getUpgradeCost(upgradeDef);
        this.gold -= cost;
        this.upgradeLevels[upgradeDef.id] = (this.upgradeLevels[upgradeDef.id] || 0) + 1;

        if (upgradeDef.apply === 'stat_add') {
            this[upgradeDef.statKey] += upgradeDef.value;
            // If maxHp increased, heal by the same amount
            if (upgradeDef.statKey === 'maxHp') {
                this.hp += upgradeDef.value;
            }
        }

        return true;
    }
}
