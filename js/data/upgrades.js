// ============================================================
// Upgrade definitions — add new upgrades here.
// apply: 'stat_add' adds value to statKey each level.
// apply: 'custom' — for future special effects.
// maxLevel: -1 = unlimited.
// ============================================================

export const UPGRADES = [
    { id: 'hp_up',      statKey: 'maxHp',         value: 20,   baseCost: 30,  costScale: 1.5, maxLevel: -1, apply: 'stat_add', category: 'defense',  name: 'HP Up',       desc: 'Increase max HP by 20' },
    { id: 'atk_up',     statKey: 'atk',            value: 3,    baseCost: 40,  costScale: 1.5, maxLevel: -1, apply: 'stat_add', category: 'offense',  name: 'ATK Up',      desc: 'Increase attack by 3' },
    { id: 'def_up',     statKey: 'def',            value: 2,    baseCost: 35,  costScale: 1.4, maxLevel: -1, apply: 'stat_add', category: 'defense',  name: 'DEF Up',      desc: 'Increase defense by 2' },
    { id: 'rcv_up',     statKey: 'rcv',            value: 2,    baseCost: 30,  costScale: 1.4, maxLevel: -1, apply: 'stat_add', category: 'defense',  name: 'RCV Up',      desc: 'Increase recovery by 2' },
    { id: 'revive',     statKey: 'revives',        value: 1,    baseCost: 100, costScale: 2.0, maxLevel: 3,  apply: 'stat_add', category: 'utility',  name: 'Revive',      desc: 'Gain 1 extra life' },
    { id: 'timeout_up', statKey: 'bonusTimeoutMs', value: 2000, baseCost: 50,  costScale: 1.8, maxLevel: 5,  apply: 'stat_add', category: 'utility',  name: 'Time Up',     desc: 'Increase drag time by 2s' },
];
