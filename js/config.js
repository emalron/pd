// ============================================================
// Game Configuration
// All tunable constants in one place for easy adjustment.
// ============================================================
export const CONFIG = {
    GAME: {
        WIDTH: 540,
        HEIGHT: 960,
        BG_COLOR: '#1a1a2e',
    },

    BOARD: {
        ROWS: 5,
        COLS: 6,
        CELL_SIZE: 82,
        GAP: 4,
        BG_COLOR: 0x16213e,
        CELL_BG_COLOR: 0x0f3460,
        CELL_BG_ALPHA: 0.5,
        CORNER_RADIUS: 12,
    },

    // Symbol definitions — add new types here to expand the palette.
    // To switch to sprites, replace `color`/`stroke` with a `spriteKey`.
    SYMBOLS: [
        { id: 0, color: 0xE84545, stroke: 0xB33636, name: 'Fire' },
        { id: 1, color: 0x4E9AF1, stroke: 0x3A78C2, name: 'Water' },
        { id: 2, color: 0x5CB85C, stroke: 0x449D44, name: 'Wood' },
        { id: 3, color: 0xF0C040, stroke: 0xC09830, name: 'Light' },
        { id: 4, color: 0xA855F7, stroke: 0x8040C0, name: 'Dark' },
        { id: 5, color: 0xEC6B9C, stroke: 0xC0507A, name: 'Heart' },
    ],

    ORB: {
        RADIUS: 34,
        SELECTED_SCALE: 1.12,
    },

    DRAG: {
        TIMEOUT_MS: 15000,
        GAUGE_RADIUS: 42,
        GAUGE_THICKNESS: 4,
    },

    ANIM: {
        SWAP_MS: 80,
        MATCH_FLASH_MS: 120,
        MATCH_DISAPPEAR_MS: 250,
        COMBO_PAUSE_MS: 200,
        FALL_MS_PER_CELL: 80,
    },

    ROGUELIKE: {
        STARTING_HP: 100,
        STARTING_ATK: 10,
        STARTING_DEF: 2,
        STARTING_RCV: 5,
        COMBO_DAMAGE_SCALE: 0.25,
        MATCH_SIZE_BONUS: 0.25,
    },
};
