import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CONFIG before importing CombatResolver
vi.mock('../js/config.js', () => ({
    CONFIG: {
        ROGUELIKE: {
            COMBO_DAMAGE_SCALE: 0.25,
            MATCH_SIZE_BONUS: 0.25,
        },
    },
}));

const { CombatResolver } = await import('../js/roguelike/CombatResolver.js');

// Helper: create a match group
function makeGroup(type, cellCount) {
    const cells = [];
    for (let i = 0; i < cellCount; i++) {
        cells.push({ row: 0, col: i });
    }
    return { type, cells };
}

describe('CombatResolver', () => {
    describe('classifyGroups', () => {
        it('should separate heart groups from attack groups', () => {
            const groups = [
                makeGroup(0, 3), // Fire (attack)
                makeGroup(5, 3), // Heart (recovery)
                makeGroup(1, 3), // Water (attack)
            ];
            const { attackGroups, recoveryGroups } = CombatResolver.classifyGroups(groups);
            expect(attackGroups).toHaveLength(2);
            expect(recoveryGroups).toHaveLength(1);
            expect(attackGroups[0].type).toBe(0);
            expect(attackGroups[1].type).toBe(1);
            expect(recoveryGroups[0].type).toBe(5);
        });

        it('should return empty arrays when no groups', () => {
            const { attackGroups, recoveryGroups } = CombatResolver.classifyGroups([]);
            expect(attackGroups).toHaveLength(0);
            expect(recoveryGroups).toHaveLength(0);
        });

        it('should handle all-heart groups', () => {
            const groups = [makeGroup(5, 3), makeGroup(5, 4)];
            const { attackGroups, recoveryGroups } = CombatResolver.classifyGroups(groups);
            expect(attackGroups).toHaveLength(0);
            expect(recoveryGroups).toHaveLength(2);
        });

        it('should handle all-attack groups', () => {
            const groups = [makeGroup(0, 3), makeGroup(2, 3)];
            const { attackGroups, recoveryGroups } = CombatResolver.classifyGroups(groups);
            expect(attackGroups).toHaveLength(2);
            expect(recoveryGroups).toHaveLength(0);
        });
    });

    describe('calculateGroupDamage', () => {
        const player = { atk: 10, def: 2, rcv: 5 };
        const monster = { def: 3 };

        it('should calculate base damage for 3-orb match (combo 1)', () => {
            // baseDamage = 10 * (1 + 0.25*(3-3)) = 10
            // comboMult = 1 + 0.25*(1-1) = 1
            // raw = floor(10*1) = 10
            // final = max(1, 10-3) = 7
            const dmg = CombatResolver.calculateGroupDamage(player, monster, makeGroup(0, 3), 1);
            expect(dmg).toBe(7);
        });

        it('should apply match size bonus for larger groups', () => {
            // baseDamage = 10 * (1 + 0.25*(5-3)) = 10 * 1.5 = 15
            // comboMult = 1 + 0.25*(1-1) = 1
            // raw = floor(15*1) = 15
            // final = max(1, 15-3) = 12
            const dmg = CombatResolver.calculateGroupDamage(player, monster, makeGroup(0, 5), 1);
            expect(dmg).toBe(12);
        });

        it('should apply combo multiplier for higher combos', () => {
            // baseDamage = 10 * 1 = 10
            // comboMult = 1 + 0.25*(3-1) = 1.5
            // raw = floor(10*1.5) = 15
            // final = max(1, 15-3) = 12
            const dmg = CombatResolver.calculateGroupDamage(player, monster, makeGroup(0, 3), 3);
            expect(dmg).toBe(12);
        });

        it('should enforce minimum damage of 1', () => {
            const weakPlayer = { atk: 1, def: 0, rcv: 0 };
            const tankMonster = { def: 999 };
            const dmg = CombatResolver.calculateGroupDamage(weakPlayer, tankMonster, makeGroup(0, 3), 1);
            expect(dmg).toBe(1);
        });
    });

    describe('calculateGroupRecovery', () => {
        const player = { atk: 10, def: 2, rcv: 5 };

        it('should calculate base recovery for 3-orb heart match', () => {
            // baseRecovery = 5 * (1 + 0.25*(3-3)) = 5
            // comboMult = 1 + 0.25*(1-1) = 1
            // total = floor(5*1) = 5
            const rcv = CombatResolver.calculateGroupRecovery(player, makeGroup(5, 3), 1);
            expect(rcv).toBe(5);
        });

        it('should scale with group size', () => {
            // baseRecovery = 5 * (1 + 0.25*(4-3)) = 5 * 1.25 = 6.25
            // comboMult = 1
            // total = floor(6.25) = 6
            const rcv = CombatResolver.calculateGroupRecovery(player, makeGroup(5, 4), 1);
            expect(rcv).toBe(6);
        });

        it('should scale with combo number', () => {
            // baseRecovery = 5 * 1 = 5
            // comboMult = 1 + 0.25*(3-1) = 1.5
            // total = floor(5*1.5) = 7
            const rcv = CombatResolver.calculateGroupRecovery(player, makeGroup(5, 3), 3);
            expect(rcv).toBe(7);
        });
    });

    describe('calculateAttackDamage', () => {
        const player = { atk: 10, def: 2, rcv: 5 };

        it('should sum damage across multiple attack groups', () => {
            const monster = { def: 0 };
            const groups = [makeGroup(0, 3), makeGroup(1, 3)];
            // baseDamage = 10 + 10 = 20
            // totalCombos = 2 → comboMult = 1 + 0.25*(2-1) = 1.25
            // rawDamage = floor(20*1.25) = 25
            // finalDamage = max(1, 25-0) = 25
            const result = CombatResolver.calculateAttackDamage(player, monster, groups, 2);
            expect(result.finalDamage).toBe(25);
            expect(result.rawDamage).toBe(25);
            expect(result.comboMultiplier).toBe(1.25);
        });

        it('should return 0 damage when no attack groups', () => {
            const monster = { def: 5 };
            const result = CombatResolver.calculateAttackDamage(player, monster, [], 1);
            expect(result.finalDamage).toBe(0);
            expect(result.rawDamage).toBe(0);
        });

        it('should subtract monster defense', () => {
            const monster = { def: 5 };
            const groups = [makeGroup(0, 3)];
            // raw = floor(10*1) = 10
            // final = max(1, 10-5) = 5
            const result = CombatResolver.calculateAttackDamage(player, monster, groups, 1);
            expect(result.finalDamage).toBe(5);
        });

        it('should enforce minimum 1 damage when raw > 0', () => {
            const monster = { def: 999 };
            const groups = [makeGroup(0, 3)];
            const result = CombatResolver.calculateAttackDamage(player, monster, groups, 1);
            expect(result.finalDamage).toBe(1);
        });
    });

    describe('calculateRecovery', () => {
        const player = { atk: 10, def: 2, rcv: 5 };

        it('should sum recovery from multiple heart groups', () => {
            const groups = [makeGroup(5, 3), makeGroup(5, 3)];
            // baseRecovery = 5 + 5 = 10
            // comboMult = 1 + 0.25*(2-1) = 1.25
            // total = floor(10*1.25) = 12
            const result = CombatResolver.calculateRecovery(player, groups);
            expect(result.totalRecovery).toBe(12);
        });

        it('should return 0 when no recovery groups', () => {
            const result = CombatResolver.calculateRecovery(player, []);
            expect(result.totalRecovery).toBe(0);
        });

        it('should handle single large heart group', () => {
            const groups = [makeGroup(5, 5)];
            // baseRecovery = 5 * (1 + 0.25*2) = 5 * 1.5 = 7.5
            // comboMult = 1 + 0.25*(1-1) = 1
            // total = floor(7.5) = 7
            const result = CombatResolver.calculateRecovery(player, groups);
            expect(result.totalRecovery).toBe(7);
        });
    });

    describe('calculateMonsterDamage', () => {
        it('should subtract player defense from monster attack', () => {
            const monster = { atk: 20 };
            const player = { def: 5 };
            expect(CombatResolver.calculateMonsterDamage(monster, player)).toBe(15);
        });

        it('should enforce minimum 1 damage', () => {
            const monster = { atk: 1 };
            const player = { def: 999 };
            expect(CombatResolver.calculateMonsterDamage(monster, player)).toBe(1);
        });

        it('should deal full damage when player has 0 def', () => {
            const monster = { atk: 30 };
            const player = { def: 0 };
            expect(CombatResolver.calculateMonsterDamage(monster, player)).toBe(30);
        });
    });
});
