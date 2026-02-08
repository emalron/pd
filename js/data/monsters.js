// ============================================================
// Monster definitions — add new monsters here.
// ============================================================

export const MONSTERS = {
    slime_green: {
        id: 'slime_green', name: 'Green Slime', element: 'wood',
        hp: 80, atk: 8, def: 0, turnCount: 2, gold: 10,
        color: 0x44BB44, scale: 0.8,
    },
    slime_red: {
        id: 'slime_red', name: 'Red Slime', element: 'fire',
        hp: 100, atk: 12, def: 0, turnCount: 2, gold: 12,
        color: 0xBB4444, scale: 0.8,
    },
    slime_blue: {
        id: 'slime_blue', name: 'Blue Slime', element: 'water',
        hp: 90, atk: 10, def: 2, turnCount: 2, gold: 12,
        color: 0x4477DD, scale: 0.8,
    },
    goblin: {
        id: 'goblin', name: 'Goblin', element: 'dark',
        hp: 150, atk: 18, def: 3, turnCount: 2, gold: 20,
        color: 0x88AA33, scale: 0.9,
    },
    golem: {
        id: 'golem', name: 'Stone Golem', element: 'light',
        hp: 300, atk: 25, def: 8, turnCount: 3, gold: 35,
        color: 0x888888, scale: 1.1,
    },
    dragon: {
        id: 'dragon', name: 'Fire Dragon', element: 'fire',
        hp: 500, atk: 40, def: 5, turnCount: 3, gold: 60,
        color: 0xCC3333, scale: 1.3,
    },
};
