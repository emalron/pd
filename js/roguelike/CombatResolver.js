import { CONFIG } from '../config.js';

// ============================================================
// CombatResolver — pure calculation module (no Phaser dependency).
// All methods are static.
// ============================================================

const HEART_TYPE_ID = 5; // CONFIG.SYMBOLS index for Heart

export class CombatResolver {
    /**
     * Split matched groups into attack and recovery groups.
     * Heart orbs = recovery, everything else = attack.
     */
    static classifyGroups(groups) {
        const attackGroups = [];
        const recoveryGroups = [];

        for (const group of groups) {
            if (group.type === HEART_TYPE_ID) {
                recoveryGroups.push(group);
            } else {
                attackGroups.push(group);
            }
        }

        return { attackGroups, recoveryGroups };
    }

    /**
     * Calculate attack damage dealt to a monster.
     * Per group: player.atk * (1 + MATCH_SIZE_BONUS * (orbCount - 3))
     * Total:     sum * (1 + COMBO_DAMAGE_SCALE * (totalCombos - 1))
     * Final:     max(1, raw - monster.def)
     */
    static calculateAttackDamage(player, monster, attackGroups, totalCombos) {
        if (attackGroups.length === 0) {
            return { finalDamage: 0, rawDamage: 0, comboMultiplier: 1 };
        }

        const r = CONFIG.ROGUELIKE;
        let baseDamage = 0;

        for (const group of attackGroups) {
            const orbCount = group.cells.length;
            baseDamage += player.atk * (1 + r.MATCH_SIZE_BONUS * (orbCount - 3));
        }

        const comboMultiplier = 1 + r.COMBO_DAMAGE_SCALE * (totalCombos - 1);
        const rawDamage = Math.floor(baseDamage * comboMultiplier);
        const finalDamage = Math.max(1, rawDamage - monster.def);

        return { finalDamage, rawDamage, comboMultiplier };
    }

    /**
     * Calculate HP recovery from heart orb matches.
     * Per group: player.rcv * (1 + MATCH_SIZE_BONUS * (orbCount - 3))
     * Total:     sum * (1 + COMBO_DAMAGE_SCALE * (heartCombos - 1))
     */
    static calculateRecovery(player, recoveryGroups) {
        if (recoveryGroups.length === 0) {
            return { totalRecovery: 0 };
        }

        const r = CONFIG.ROGUELIKE;
        let baseRecovery = 0;

        for (const group of recoveryGroups) {
            const orbCount = group.cells.length;
            baseRecovery += player.rcv * (1 + r.MATCH_SIZE_BONUS * (orbCount - 3));
        }

        const comboMultiplier = 1 + r.COMBO_DAMAGE_SCALE * (recoveryGroups.length - 1);
        const totalRecovery = Math.floor(baseRecovery * comboMultiplier);

        return { totalRecovery };
    }

    /**
     * Calculate damage a monster deals to the player.
     */
    static calculateMonsterDamage(monster, player) {
        return Math.max(1, monster.atk - player.def);
    }
}
