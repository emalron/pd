import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CONFIG before importing PlayerState
vi.mock('../js/config.js', () => ({
    CONFIG: {
        ROGUELIKE: {
            STARTING_HP: 100,
            STARTING_ATK: 10,
            STARTING_DEF: 2,
            STARTING_RCV: 5,
        },
        DRAG: {
            TIMEOUT_MS: 15000,
        },
    },
}));

const { PlayerState } = await import('../js/roguelike/PlayerState.js');

describe('PlayerState', () => {
    let ps;

    beforeEach(() => {
        ps = new PlayerState();
    });

    describe('constructor', () => {
        it('should initialize with starting stats from CONFIG', () => {
            expect(ps.maxHp).toBe(100);
            expect(ps.hp).toBe(100);
            expect(ps.atk).toBe(10);
            expect(ps.def).toBe(2);
            expect(ps.rcv).toBe(5);
        });

        it('should start with 0 gold and 0 revives', () => {
            expect(ps.gold).toBe(0);
            expect(ps.revives).toBe(0);
        });

        it('should start at world 0, stage 0, monster 0', () => {
            expect(ps.worldIdx).toBe(0);
            expect(ps.stageIdx).toBe(0);
            expect(ps.monsterIdx).toBe(0);
        });

        it('should start with empty upgrade levels', () => {
            expect(ps.upgradeLevels).toEqual({});
        });
    });

    describe('heal', () => {
        it('should increase hp by the given amount', () => {
            ps.hp = 50;
            ps.heal(20);
            expect(ps.hp).toBe(70);
        });

        it('should not exceed maxHp', () => {
            ps.hp = 90;
            ps.heal(50);
            expect(ps.hp).toBe(100);
        });

        it('should handle healing when already at full hp', () => {
            ps.heal(10);
            expect(ps.hp).toBe(100);
        });
    });

    describe('takeDamage', () => {
        it('should reduce hp by (rawDamage - def), min 1', () => {
            ps.hp = 100;
            // actual = max(1, 20-2) = 18
            const actual = ps.takeDamage(20);
            expect(actual).toBe(18);
            expect(ps.hp).toBe(82);
        });

        it('should deal minimum 1 damage even when def exceeds rawDamage', () => {
            ps.hp = 100;
            const actual = ps.takeDamage(1); // max(1, 1-2) = 1
            expect(actual).toBe(1);
            expect(ps.hp).toBe(99);
        });

        it('should not reduce hp below 0', () => {
            ps.hp = 5;
            ps.takeDamage(100);
            expect(ps.hp).toBe(0);
        });

        it('should return the actual damage dealt', () => {
            ps.hp = 100;
            ps.def = 5;
            const actual = ps.takeDamage(10); // max(1, 10-5) = 5
            expect(actual).toBe(5);
        });
    });

    describe('isDead', () => {
        it('should return true when hp is 0', () => {
            ps.hp = 0;
            expect(ps.isDead()).toBe(true);
        });

        it('should return false when hp is positive', () => {
            ps.hp = 1;
            expect(ps.isDead()).toBe(false);
        });

        it('should return true when hp is negative (edge case)', () => {
            ps.hp = -5;
            expect(ps.isDead()).toBe(true);
        });
    });

    describe('tryRevive', () => {
        it('should revive when revives > 0', () => {
            ps.hp = 0;
            ps.revives = 1;
            const result = ps.tryRevive();
            expect(result).toBe(true);
            expect(ps.hp).toBe(100);
            expect(ps.revives).toBe(0);
        });

        it('should fail when revives = 0', () => {
            ps.hp = 0;
            ps.revives = 0;
            const result = ps.tryRevive();
            expect(result).toBe(false);
            expect(ps.hp).toBe(0);
        });

        it('should decrement revive count on use', () => {
            ps.revives = 3;
            ps.hp = 0;
            ps.tryRevive();
            expect(ps.revives).toBe(2);
        });
    });

    describe('getUpgradeCost', () => {
        const upgradeDef = { id: 'atk_up', baseCost: 100, costScale: 1.5 };

        it('should return baseCost at level 0', () => {
            expect(ps.getUpgradeCost(upgradeDef)).toBe(100);
        });

        it('should scale cost by costScale^level', () => {
            ps.upgradeLevels['atk_up'] = 1;
            // floor(100 * 1.5^1) = 150
            expect(ps.getUpgradeCost(upgradeDef)).toBe(150);
        });

        it('should scale exponentially for higher levels', () => {
            ps.upgradeLevels['atk_up'] = 2;
            // floor(100 * 1.5^2) = floor(225) = 225
            expect(ps.getUpgradeCost(upgradeDef)).toBe(225);
        });
    });

    describe('canPurchaseUpgrade', () => {
        const upgradeDef = { id: 'atk_up', baseCost: 100, costScale: 1.0, maxLevel: 5 };

        it('should return true when gold is sufficient', () => {
            ps.gold = 100;
            expect(ps.canPurchaseUpgrade(upgradeDef)).toBe(true);
        });

        it('should return false when gold is insufficient', () => {
            ps.gold = 50;
            expect(ps.canPurchaseUpgrade(upgradeDef)).toBe(false);
        });

        it('should return false when at max level', () => {
            ps.gold = 9999;
            ps.upgradeLevels['atk_up'] = 5;
            expect(ps.canPurchaseUpgrade(upgradeDef)).toBe(false);
        });

        it('should allow unlimited purchases when maxLevel is -1', () => {
            const unlimitedDef = { id: 'hp_up', baseCost: 50, costScale: 1.0, maxLevel: -1 };
            ps.gold = 9999;
            ps.upgradeLevels['hp_up'] = 100;
            expect(ps.canPurchaseUpgrade(unlimitedDef)).toBe(true);
        });
    });

    describe('purchaseUpgrade', () => {
        it('should deduct gold and increment level', () => {
            const upgradeDef = {
                id: 'atk_up', baseCost: 100, costScale: 1.0, maxLevel: 5,
                apply: 'stat_add', statKey: 'atk', value: 5,
            };
            ps.gold = 200;
            const result = ps.purchaseUpgrade(upgradeDef);
            expect(result).toBe(true);
            expect(ps.gold).toBe(100);
            expect(ps.upgradeLevels['atk_up']).toBe(1);
            expect(ps.atk).toBe(15);
        });

        it('should return false when cannot afford', () => {
            const upgradeDef = {
                id: 'atk_up', baseCost: 100, costScale: 1.0, maxLevel: 5,
                apply: 'stat_add', statKey: 'atk', value: 5,
            };
            ps.gold = 10;
            const result = ps.purchaseUpgrade(upgradeDef);
            expect(result).toBe(false);
            expect(ps.atk).toBe(10); // unchanged
        });

        it('should heal when maxHp is upgraded', () => {
            const upgradeDef = {
                id: 'hp_up', baseCost: 50, costScale: 1.0, maxLevel: -1,
                apply: 'stat_add', statKey: 'maxHp', value: 20,
            };
            ps.gold = 100;
            ps.hp = 80;
            ps.purchaseUpgrade(upgradeDef);
            expect(ps.maxHp).toBe(120);
            expect(ps.hp).toBe(100); // healed by value (20)
        });

        it('should not apply stat for non stat_add upgrades', () => {
            const upgradeDef = {
                id: 'revive', baseCost: 200, costScale: 1.0, maxLevel: 3,
                apply: 'custom', statKey: null, value: 0,
            };
            ps.gold = 300;
            const result = ps.purchaseUpgrade(upgradeDef);
            expect(result).toBe(true);
            expect(ps.gold).toBe(100);
            expect(ps.upgradeLevels['revive']).toBe(1);
        });
    });
});
