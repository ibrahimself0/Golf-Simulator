import * as THREE from 'three'
import { BallPhysics } from '../../domain/physics/BallPhysics'
import { ClubImpact } from '../../domain/physics/ClubImpact'
import { PhysicsEngine } from '../../domain/physics/PhysicsEngine'
import type { ClubImpactResult } from '../../domain/physics/PhysicsTypes'
import type { ShotSettings } from './ShotSettings'

/** Bridges shot settings to physics and a small club animation. */
export class HitController {
  private readonly physicsEngine: PhysicsEngine
  private readonly ball: BallPhysics
  private readonly clubObject: THREE.Object3D
  private settings: ShotSettings
  private animationTime = 0
  private isAnimating = false
  private readonly animationDuration = 0.28

  constructor(
    physicsEngine: PhysicsEngine,
    ball: BallPhysics,
    clubObject: THREE.Object3D,
    initialSettings: ShotSettings
  ) {
    this.physicsEngine = physicsEngine
    this.ball = ball
    this.clubObject = clubObject
    this.settings = { ...initialSettings }
  }

  hit(aimDirection: THREE.Vector3): ClubImpactResult | null {
    if (!this.ball.settleForHit()) {
      return null
    }

    const horizontalAim = this.getShotDirection(aimDirection)
    if (horizontalAim.lengthSq() === 0) {
      return null
    }

    const result = this.physicsEngine.hitBall(this.ball, {
      clubHeadVelocity: horizontalAim.clone().multiplyScalar(this.getClubHeadSpeed()),
      faceNormal: ClubImpact.createFaceNormal(horizontalAim, this.settings.launchAngleDegrees),
      effectiveClubMass: this.settings.effectiveClubMass,
      restitution: this.settings.restitution,
      friction: this.settings.friction,
    })

    if (result.didHit) {
      this.ball.applyShotSpin(
        horizontalAim,
        this.settings.spinPercent,
        this.settings.sideSpinPercent
      )
      this.animationTime = 0
      this.isAnimating = true
    }

    return result
  }

  update(deltaTime: number): void {
    const baseBackswing = -0.42

    if (!this.isAnimating) {
      this.clubObject.rotation.x = baseBackswing
      return
    }

    this.animationTime += Math.max(0, deltaTime)
    const progress = Math.min(this.animationTime / this.animationDuration, 1)

    // A proper swing has a small backswing, a fast downswing through the ball,
    // and a follow-through. Smoothstep/ease curves make it feel less robotic.
    const eased = progress < 0.34
      ? -0.42 - THREE.MathUtils.smoothstep(progress / 0.34, 0, 1) * 0.55
      : -0.97 + THREE.MathUtils.smoothstep((progress - 0.34) / 0.66, 0, 1) * 1.95
    this.clubObject.rotation.x = eased

    if (progress >= 1) {
      this.isAnimating = false
      this.clubObject.rotation.x = baseBackswing
    }
  }

  getShotDirection(aimDirection: THREE.Vector3): THREE.Vector3 {
    const horizontalAim = new THREE.Vector3(aimDirection.x, 0, aimDirection.z)
    if (horizontalAim.lengthSq() === 0) {
      return new THREE.Vector3()
    }

    return horizontalAim
      .normalize()
      .applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.degToRad(this.settings.directionDegrees)
      )
  }

  setSettings(settings: Partial<ShotSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
    }
    this.clampSettings()
  }

  getSettings(): Readonly<ShotSettings> {
    return this.settings
  }

  getClubHeadSpeed(): number {
    const minimumSpeed = Math.min(this.settings.minClubHeadSpeed, this.settings.maxClubHeadSpeed)
    const maximumSpeed = Math.max(this.settings.minClubHeadSpeed, this.settings.maxClubHeadSpeed)
    const powerFactor = THREE.MathUtils.clamp(this.settings.hitPower, 0, 100) / 100

    return THREE.MathUtils.lerp(minimumSpeed, maximumSpeed, powerFactor)
  }

  reset(): void {
    this.animationTime = 0
    this.isAnimating = false
    this.clubObject.rotation.x = -0.42
  }

  private clampSettings(): void {
    this.settings.hitPower = THREE.MathUtils.clamp(this.settings.hitPower, 0, 100)
    this.settings.minClubHeadSpeed = Math.max(0, this.settings.minClubHeadSpeed)
    this.settings.maxClubHeadSpeed = Math.max(0, this.settings.maxClubHeadSpeed)
    this.settings.launchAngleDegrees = THREE.MathUtils.clamp(
      this.settings.launchAngleDegrees,
      0,
      45
    )
    this.settings.directionDegrees = THREE.MathUtils.euclideanModulo(this.settings.directionDegrees, 360)
    this.settings.spinPercent = THREE.MathUtils.clamp(this.settings.spinPercent, -100, 100)
    this.settings.sideSpinPercent = THREE.MathUtils.clamp(this.settings.sideSpinPercent, -100, 100)
    this.settings.effectiveClubMass = Math.max(0.01, this.settings.effectiveClubMass)
    this.settings.restitution = THREE.MathUtils.clamp(this.settings.restitution, 0, 1)
    this.settings.friction = Math.max(0, this.settings.friction)
    this.settings.showTrajectoryPreview = Boolean(this.settings.showTrajectoryPreview)
  }
}
