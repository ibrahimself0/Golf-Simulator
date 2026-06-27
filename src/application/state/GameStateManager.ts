/**
 * ============================================================================
 * LAYER 2: GAME STATE MANAGER STUB
 * ============================================================================
 *
 * Manages game state: turn, score, ball status, etc.
 *
 * For now this is a stub. In a full implementation, it would:
 * - Track whose turn it is
 * - Manage score and hole progress
 * - Track ball state (moving, at rest, in hole, etc.)
 * - Emit events when state changes
 */

export class GameStateManager {
  private score: number = 0;
  private currentHole: number = 1;
  private strokeCount: number = 0;

  /**
   * Increment score.
   */
  addStroke(): void {
    this.strokeCount++;
  }

  /**
   * Reset for new hole.
   */
  resetHole(): void {
    this.currentHole++;
    this.strokeCount = 0;
  }

  /**
   * Get current score.
   */
  getScore(): number {
    return this.score;
  }

  /**
   * Get current hole.
   */
  getCurrentHole(): number {
    return this.currentHole;
  }

  /**
   * Get strokes on current hole.
   */
  getStrokeCount(): number {
    return this.strokeCount;
  }
}
