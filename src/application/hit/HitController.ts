import * as THREE from 'three'
import { BallPhysics } from '../../domain/physics/BallPhysics'
import { ClubImpact } from '../../domain/physics/ClubImpact'
import { PhysicsEngine } from '../../domain/physics/PhysicsEngine'
import type { ClubImpactResult } from '../../domain/physics/PhysicsTypes'
import type { HitStrengthLevel } from './HitStrengthLevels'

/** Bridges keyboard-level shot choices to physics and a small club animation. */
export class HitController {
  private readonly physicsEngine: PhysicsEngine
  private readonly ball: BallPhysics
  private readonly clubObject: THREE.Object3D
  private readonly levels: readonly HitStrengthLevel[]
  private selectedLevelIndex: number
  private readonly restRotation: THREE.Euler
  private animationTime = 0
  private isAnimating = false
  private readonly animationDuration = 0.28

  constructor(
    physicsEngine: PhysicsEngine,
    ball: BallPhysics,
    clubObject: THREE.Object3D,
    levels: readonly HitStrengthLevel[],
    initialLevelIndex: number = 1
  ) {
    if (levels.length === 0) {
      throw new Error('At least one hit strength level is required')
    }

    this.physicsEngine = physicsEngine
    this.ball = ball
    this.clubObject = clubObject
    this.levels = levels
    this.selectedLevelIndex = Math.min(
      Math.max(initialLevelIndex, 0),
      levels.length - 1
    )
    this.restRotation = clubObject.rotation.clone()
  }

  hit(aimDirection: THREE.Vector3): ClubImpactResult | null {
    if (this.ball.isActive()) {
      return null
    }

    const horizontalAim = new THREE.Vector3(aimDirection.x, 0, aimDirection.z)
    if (horizontalAim.lengthSq() === 0) {
      return null
    }
    horizontalAim.normalize()

    const level = this.getSelectedLevel()
    const result = this.physicsEngine.hitBall(this.ball, {
      clubHeadVelocity: horizontalAim.clone().multiplyScalar(level.clubHeadSpeed),
      faceNormal: ClubImpact.createFaceNormal(horizontalAim, level.loftDegrees),
      effectiveClubMass: level.effectiveClubMass,
      restitution: level.restitution,
      friction: level.friction,
    })

    if (result.didHit) {
      this.animationTime = 0
      this.isAnimating = true
    }

    return result
  }

  update(deltaTime: number): void {
    if (!this.isAnimating) {
      return
    }

    this.animationTime += Math.max(0, deltaTime)
    const progress = Math.min(this.animationTime / this.animationDuration, 1)
    this.clubObject.rotation.copy(this.restRotation)
    this.clubObject.rotation.z += Math.sin(progress * Math.PI) * 0.9

    if (progress >= 1) {
      this.isAnimating = false
      this.clubObject.rotation.copy(this.restRotation)
    }
  }

  selectLevel(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.levels.length) {
      return false
    }

    this.selectedLevelIndex = index
    return true
  }

  selectLevelFromNumberKey(key: string): boolean {
    if (!/^[1-9]$/.test(key)) {
      return false
    }
    return this.selectLevel(Number(key) - 1)
  }

  selectNextLevel(): HitStrengthLevel {
    this.selectedLevelIndex = (this.selectedLevelIndex + 1) % this.levels.length
    return this.getSelectedLevel()
  }

  selectPreviousLevel(): HitStrengthLevel {
    this.selectedLevelIndex =
      (this.selectedLevelIndex - 1 + this.levels.length) % this.levels.length
    return this.getSelectedLevel()
  }

  getSelectedLevel(): HitStrengthLevel {
    return this.levels[this.selectedLevelIndex]
  }

  reset(): void {
    this.animationTime = 0
    this.isAnimating = false
    this.clubObject.rotation.copy(this.restRotation)
  }
}
