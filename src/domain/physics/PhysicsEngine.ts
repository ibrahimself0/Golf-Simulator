/**
 * Owns and advances the independent physics objects in the golf simulation.
 * It deliberately exposes no meshes, cameras or input events.
 */

import { BallPhysics } from './BallPhysics'
import { GreenTerrain } from './GreenTerrain'
import type { ClubImpactInput, ClubImpactResult } from './PhysicsTypes'

export class PhysicsEngine {
  private readonly physicsObjects: BallPhysics[] = []
  private readonly terrain: GreenTerrain

  constructor(terrain: GreenTerrain) {
    this.terrain = terrain
  }

  addObject(object: BallPhysics): void {
    if (!this.physicsObjects.includes(object)) {
      this.physicsObjects.push(object)
    }
  }

  removeObject(object: BallPhysics): void {
    const index = this.physicsObjects.indexOf(object)
    if (index >= 0) {
      this.physicsObjects.splice(index, 1)
    }
  }

  update(deltaTime: number): void {
    for (const object of this.physicsObjects) {
      object.update(deltaTime)
    }
  }

  /** Entry point for a future controller when it connects a club swing. */
  hitBall(ball: BallPhysics, impact: ClubImpactInput): ClubImpactResult {
    if (!this.physicsObjects.includes(ball)) {
      throw new Error('The ball must be registered before it can be hit')
    }
    return ball.hitByClub(impact)
  }

  getTerrain(): GreenTerrain {
    return this.terrain
  }

  getObjects(): readonly BallPhysics[] {
    return this.physicsObjects
  }
}
