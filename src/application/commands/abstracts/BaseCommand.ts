/**
 * ============================================================================
 * LAYER 2: ABSTRACT BASE COMMAND
 * ============================================================================
 *
 * Defines the interface that all game commands must follow.
 * Uses the Command Pattern: each player action is encapsulated as a command.
 *
 * Benefits:
 * - Decouples UI layer (who triggers the command) from logic (who executes it)
 * - Enables undo/redo functionality
 * - Allows command queuing and replay for debugging
 * - Makes it easy to test game logic: just create a command and execute it
 *
 * Example:
 *   const swingCommand = new SwingCommand(power, angle);
 *   commandExecutor.execute(swingCommand);
 *
 * Subclasses must implement:
 * - execute(): Perform the action (e.g., swing the club)
 * - undo(): Reverse the action (e.g., restore ball position)
 */

import { GameContext } from '../../types/GameContext';

export abstract class BaseCommand {
  /**
   * Execute the command.
   * Called when the action is confirmed by the user.
   *
   * @param context - The game context containing state, physics engine, etc.
   */
  abstract execute(context: GameContext): void;

  /**
   * Undo the command.
   * Called if the player wants to undo/restart.
   * Must restore the game to the state before execute() was called.
   *
   * @param context - The game context
   */
  abstract undo(context: GameContext): void;

  /**
   * Optional: Get a human-readable name for this command.
   * Useful for debugging and logging.
   */
  getName(): string {
    return this.constructor.name;
  }

  /**
   * Optional: Check if this command can be executed right now.
   * (e.g., can't swing if the ball is already moving)
   */
  canExecute(context: GameContext): boolean {
    return true;
  }
}
