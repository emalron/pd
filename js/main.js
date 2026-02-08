import { CONFIG } from './config.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';

// ============================================================
// Phaser 3 bootstrap
// ============================================================

const config = {
    type: Phaser.AUTO,
    width: CONFIG.GAME.WIDTH,
    height: CONFIG.GAME.HEIGHT,
    parent: 'game-container',
    backgroundColor: CONFIG.GAME.BG_COLOR,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MenuScene, GameScene],
};

new Phaser.Game(config);
