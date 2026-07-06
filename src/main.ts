/**
 * ============================================================================
 * MAIN ENTRY POINT
 * ============================================================================
 *
 * This is where the application starts.
 * It finds the canvas element and creates the GameController.
 *
 * Everything after this is driven by the GameController's game loop.
 */

import { GameController } from './application/GameController';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Find the canvas element
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  if (!canvas) {
    throw new Error('❌ No #canvas element found in index.html');
  }

  // Create and initialize the game
  const game = new GameController(canvas);

  // For debugging: expose to window
  (window as any).game = game;

  // Hot-module replacement cleanup (Vite only)
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.dispose();
    });
  }
});
