// ============================================================
// World / stage definitions — add new worlds here.
// ============================================================

export const WORLDS = [
    {
        id: 'forest', name: 'Dark Forest',
        stages: [
            { name: 'Forest Edge', monsters: ['slime_green', 'slime_green'] },
            { name: 'Deep Woods', monsters: ['slime_green', 'slime_red', 'goblin'] },
            { name: 'Forest Heart', monsters: ['goblin', 'goblin', 'golem'] },
        ],
    },
    {
        id: 'volcano', name: 'Volcanic Depths',
        stages: [
            { name: 'Lava Fields', monsters: ['slime_red', 'slime_red', 'goblin'] },
            { name: 'Magma Caverns', monsters: ['golem', 'goblin', 'goblin'] },
            { name: "Dragon's Lair", monsters: ['golem', 'dragon'] },
        ],
    },
];
