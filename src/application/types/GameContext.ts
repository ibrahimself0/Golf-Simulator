/**
 * ============================================================================
 * LAYER 2: GAME CONTEXT TYPE
 * ============================================================================
 *
 * GameContext is passed to all commands.
 * It contains references to all major systems that a command might need to access.
 *
 * Think of it as a "service locator" pattern:
 * Commands don't create their dependencies, they receive them via context.
 *
 * This keeps commands:
 * - Decoupled from specific implementations
 * - Easy to test (mock the context)
 * - Flexible (can swap implementations)
 */

import { GameStateManager } from '../state/GameStateManager';
import { PhysicsEngine } from '../../domain/physics/PhysicsEngine';
import { SceneManager } from '../../rendering/SceneManager';

/**
 * Context passed to all commands.
 * Contains the major systems that commands interact with.
 */
export interface GameContext {
  /**
   * Game state manager (who's turn, score, etc.)
   */
  stateManager: GameStateManager;

  /**
   * Physics engine (ball movement, terrain, etc.)
   */
  physicsEngine: PhysicsEngine;

  /**
   * Scene manager (for adding/removing visual objects)
   */
  sceneManager: SceneManager;

  /**
   * Current delta time (for physics calculations).
   */
  deltaTime: number;
}
