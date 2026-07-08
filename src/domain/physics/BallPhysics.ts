/**
 * Golf-ball rigid-body physics. This module is independent from rendering and
 * works entirely in SI units.
 *
 * Airborne forces:
 *   gravity, quadratic aerodynamic drag and spin-induced Magnus lift.
 * Ground motion:
 *   collision impulse, restitution, impact friction, slope gravity and
 *   rolling resistance.
 */

import * as THREE from 'three'
import { BasePhysicsObject } from './abstracts/BasePhysicsObject'
import { ClubImpact } from './ClubImpact'
import { GreenTerrain } from './GreenTerrain'
import { DEFAULT_BALL_PHYSICS } from './PhysicsTypes'
import type {
  BallMotionState,
  BallPhysicsConfig,
  ClubImpactInput,
  ClubImpactResult,
} from './PhysicsTypes'

const TREE_COLLISION_RESTITUTION = 0.32
const TREE_COLLISION_TANGENTIAL_DAMPING = 0.48
const TREE_COLLISION_SPIN_DAMPING = 0.45
const FLAG_COLLISION_RESTITUTION = 0.42
const FLAG_COLLISION_TANGENTIAL_DAMPING = 0.58
const FLAG_COLLISION_SPIN_DAMPING = 0.55

export class BallPhysics extends BasePhysicsObject {
  private readonly terrain: GreenTerrain
  private readonly config: BallPhysicsConfig
  private crossSectionArea: number
  private angularVelocity = new THREE.Vector3()
  private rollingRotation = new THREE.Euler()
  private motionState: BallMotionState = 'resting'
  private boundaryHalfSize: number | null = null
  private nearRestTime = 0
  private readonly restHoldDuration = 0.25

  constructor(
    id: string,
    initialPosition: THREE.Vector3,
    terrain: GreenTerrain,
    config: Partial<BallPhysicsConfig> = {}
  ) {
    super(id, initialPosition)
    this.terrain = terrain
    this.config = {
      ...DEFAULT_BALL_PHYSICS,
      ...config,
      windVelocity: (config.windVelocity ?? DEFAULT_BALL_PHYSICS.windVelocity).clone(),
    }
    this.validateConfiguration()
    this.crossSectionArea = Math.PI * this.config.radius * this.config.radius
    this.velocity.set(0, 0, 0)
    this._isActive = false
    this.placeOnTerrain()
  }

  /** Advances the ball using small substeps so fast shots do not cross the ground. */
  update(deltaTime: number): void {
    if (!this._isActive || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return
    }

    let remainingTime = Math.min(deltaTime, this.config.maximumDeltaTime)
    while (remainingTime > 0 && this._isActive) {
      const step = Math.min(remainingTime, this.config.simulationStep)
      if (this.motionState === 'airborne') {
        this.integrateAirborne(step)
      } else {
        this.integrateGrounded(step)
      }
      this.resolveTreeCollisions()
      this.resolveFlagCollision()
      this.resolveBoundaryCollision()
      this.integrateRotation(step)
      this.updateSleepState(step)
      remainingTime -= step
    }
  }

  /** Gravity, aerodynamic drag and Magnus lift during flight. */
  private integrateAirborne(deltaTime: number): void {
    const force = new THREE.Vector3(0, -this.config.mass * this.config.gravity, 0)
    const relativeAirVelocity = this.velocity.clone().sub(this.config.windVelocity)
    const airSpeed = relativeAirVelocity.length()

    if (airSpeed > 0) {
      const dragMagnitude =
        0.5 *
        this.config.airDensity *
        this.config.dragCoefficient *
        this.crossSectionArea *
        airSpeed *
        airSpeed
      force.addScaledVector(relativeAirVelocity, -dragMagnitude / airSpeed)

      const spinSpeed = this.angularVelocity.length()
      if (spinSpeed > 0) {
        const spinRatio = (spinSpeed * this.config.radius) / airSpeed
        const liftCoefficient = Math.min(
          this.config.maximumLiftCoefficient,
          this.config.magnusCoefficient * spinRatio
        )
        const liftDirection = this.angularVelocity.clone().cross(relativeAirVelocity)

        if (liftDirection.lengthSq() > 0) {
          const liftMagnitude =
            0.5 *
            this.config.airDensity *
            liftCoefficient *
            this.crossSectionArea *
            airSpeed *
            airSpeed
          force.add(liftDirection.normalize().multiplyScalar(liftMagnitude))
        }
      }
    }

    // Semi-implicit Euler is stable enough at the fixed 240 Hz physics step.
    this.velocity.addScaledVector(force, deltaTime / this.config.mass)
    this.position.addScaledVector(this.velocity, deltaTime)
    this.resolveTerrainCollision()
  }

  /** Slope acceleration and rolling resistance while the ball is in contact. */
  private integrateGrounded(deltaTime: number): void {
    const normal = this.terrain.getSurfaceNormalAt(this.position.x, this.position.z)
    this.velocity.addScaledVector(normal, -this.velocity.dot(normal))

    const gravity = new THREE.Vector3(0, -this.config.gravity, 0)
    const slopeAcceleration = gravity
      .clone()
      .addScaledVector(normal, -gravity.dot(normal))
      .multiplyScalar(this.config.slopeStrength)
    const resistanceMagnitude = this.config.rollingResistance * this.config.gravity
    const groundSpeed = this.velocity.length()
    const previousVelocity = this.velocity.clone()
    const contactOffset = normal.clone().multiplyScalar(-this.config.radius)
    const contactVelocity = this.velocity
      .clone()
      .add(this.angularVelocity.clone().cross(contactOffset))
    const slipVelocity = contactVelocity.addScaledVector(normal, -contactVelocity.dot(normal))
    const isSliding = slipVelocity.length() >= this.config.stopSpeed

    if (isSliding) {
      // Friction also changes spin. For a solid sphere, contact acceleration
      // is 3.5 times its linear friction acceleration.
      const frictionAccelerationMagnitude = Math.min(
        this.config.slidingFriction * this.config.gravity,
        slipVelocity.length() / (3.5 * deltaTime)
      )
      const frictionAcceleration = slipVelocity
        .normalize()
        .multiplyScalar(-frictionAccelerationMagnitude)
      slopeAcceleration.add(frictionAcceleration)

      const inertia = (2 / 5) * this.config.mass * this.config.radius * this.config.radius
      const frictionForce = frictionAcceleration.multiplyScalar(this.config.mass)
      this.angularVelocity.addScaledVector(
        contactOffset.clone().cross(frictionForce),
        deltaTime / inertia
      )
    } else if (groundSpeed < this.config.stopSpeed) {
      if (slopeAcceleration.length() <= resistanceMagnitude) {
        this.stop()
        return
      }

      this.velocity.set(0, 0, 0)
      slopeAcceleration.addScaledVector(slopeAcceleration.clone().normalize(), -resistanceMagnitude)
    } else {
      slopeAcceleration.addScaledVector(this.velocity.clone().normalize(), -resistanceMagnitude)
    }

    this.velocity.addScaledVector(slopeAcceleration, deltaTime)

    // Resistance must not reverse a ball on an almost-flat patch in one step.
    if (!isSliding && groundSpeed > 0 && this.velocity.dot(previousVelocity) < 0) {
      this.velocity.set(0, 0, 0)
    }

    this.position.addScaledVector(this.velocity, deltaTime)
    this.placeOnTerrain()

    const newNormal = this.terrain.getSurfaceNormalAt(this.position.x, this.position.z)
    this.velocity.addScaledVector(newNormal, -this.velocity.dot(newNormal))
    const newContactOffset = newNormal.clone().multiplyScalar(-this.config.radius)
    const newContactVelocity = this.velocity
      .clone()
      .add(this.angularVelocity.clone().cross(newContactOffset))
    const newSlipVelocity = newContactVelocity.addScaledVector(
      newNormal,
      -newContactVelocity.dot(newNormal)
    )

    if (newSlipVelocity.length() < this.config.stopSpeed) {
      this.angularVelocity
        .copy(this.velocity.clone().cross(newNormal))
        .divideScalar(this.config.radius)
    }

    if (
      this.velocity.length() < this.config.stopSpeed &&
      newSlipVelocity.length() < this.config.stopSpeed
    ) {
      const newSlope = gravity.clone().addScaledVector(newNormal, -gravity.dot(newNormal))
      if (newSlope.length() <= resistanceMagnitude) {
        this.stop()
      }
    }
  }

  /** Resolves a sphere-plane collision using the terrain's local surface normal. */
  private resolveTerrainCollision(): void {
    const normal = this.terrain.getSurfaceNormalAt(this.position.x, this.position.z)
    const contactHeight = this.getContactHeight(normal)
    if (this.position.y > contactHeight) {
      return
    }

    this.position.y = contactHeight
    const normalSpeed = this.velocity.dot(normal)
    if (normalSpeed >= 0) {
      return
    }

    const contactOffset = normal.clone().multiplyScalar(-this.config.radius)
    const contactVelocity = this.velocity
      .clone()
      .add(this.angularVelocity.clone().cross(contactOffset))
    const slipVelocity = contactVelocity.addScaledVector(normal, -contactVelocity.dot(normal))
    const inertia = (2 / 5) * this.config.mass * this.config.radius * this.config.radius
    const inverseTangentialMass =
      1 / this.config.mass + (this.config.radius * this.config.radius) / inertia
    const frictionImpulse = slipVelocity.multiplyScalar(-1 / inverseTangentialMass)
    const normalImpulseMagnitude = this.config.mass * (1 + this.config.restitution) * -normalSpeed
    const maximumFrictionImpulse = this.config.impactFriction * normalImpulseMagnitude
    if (frictionImpulse.length() > maximumFrictionImpulse) {
      frictionImpulse.setLength(maximumFrictionImpulse)
    }

    this.velocity.addScaledVector(frictionImpulse, 1 / this.config.mass)
    this.angularVelocity.addScaledVector(contactOffset.clone().cross(frictionImpulse), 1 / inertia)
    const reboundSpeed = -normalSpeed * this.config.restitution
    this.velocity.addScaledVector(normal, (1 + this.config.restitution) * -normalSpeed)

    if (reboundSpeed > this.config.bounceSpeed) {
      this.motionState = 'airborne'
    } else {
      this.velocity.addScaledVector(normal, -this.velocity.dot(normal))
      this.motionState = 'grounded'
    }
  }

  /**
   * Resolves ball collision against every generated tree trunk.
   * The tree hitbox is intentionally simple: an invisible vertical cylinder
   * around the trunk, which is light enough for many procedural trees.
   */
  private resolveTreeCollisions(): void {
    const trees = this.terrain.getTreeInstances()
    if (trees.length === 0) {
      return
    }

    for (const tree of trees) {
      const didCollide = this.resolveVerticalCylinderCollision(
        tree.x,
        tree.z,
        tree.colliderRadius,
        tree.colliderHeight,
        TREE_COLLISION_RESTITUTION,
        TREE_COLLISION_TANGENTIAL_DAMPING,
        TREE_COLLISION_SPIN_DAMPING
      )

      if (didCollide && !this._isActive) {
        return
      }
    }
  }

  private resolveFlagCollision(): void {
    const flag = this.terrain.getFlagCollider()
    this.resolveVerticalCylinderCollision(
      flag.x,
      flag.z,
      flag.radius,
      flag.height,
      FLAG_COLLISION_RESTITUTION,
      FLAG_COLLISION_TANGENTIAL_DAMPING,
      FLAG_COLLISION_SPIN_DAMPING
    )
  }

  private resolveVerticalCylinderCollision(
    centerX: number,
    centerZ: number,
    colliderRadius: number,
    colliderHeight: number,
    restitution: number,
    tangentialDamping: number,
    spinDamping: number
  ): boolean {
    const dx = this.position.x - centerX
    const dz = this.position.z - centerZ
    const combinedRadius = colliderRadius + this.config.radius
    const distanceSq = dx * dx + dz * dz

    if (distanceSq >= combinedRadius * combinedRadius) {
      return false
    }

    const colliderBaseHeight = this.terrain.getHeightAt(centerX, centerZ)
    const ballBottom = this.position.y - this.config.radius
    const ballTop = this.position.y + this.config.radius

    if (ballTop < colliderBaseHeight || ballBottom > colliderBaseHeight + colliderHeight) {
      return false
    }

    const distance = Math.sqrt(distanceSq)
    let normalX = 1
    let normalZ = 0

    if (distance > 1e-6) {
      normalX = dx / distance
      normalZ = dz / distance
    } else {
      const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z)
      if (horizontalVelocity.lengthSq() > 1e-8) {
        horizontalVelocity.normalize().multiplyScalar(-1)
        normalX = horizontalVelocity.x
        normalZ = horizontalVelocity.z
      }
    }

    const penetration = combinedRadius - distance
    this.position.x += normalX * penetration
    this.position.z += normalZ * penetration

    const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z)
    const normalSpeed = horizontalVelocity.x * normalX + horizontalVelocity.z * normalZ

    if (normalSpeed < 0) {
      const tangentVelocity = horizontalVelocity
        .clone()
        .add(new THREE.Vector3(normalX, 0, normalZ).multiplyScalar(-normalSpeed))
      const reflectedNormalVelocity = new THREE.Vector3(normalX, 0, normalZ).multiplyScalar(
        -normalSpeed * restitution
      )
      const newHorizontalVelocity = reflectedNormalVelocity.add(
        tangentVelocity.multiplyScalar(tangentialDamping)
      )
      this.velocity.x = newHorizontalVelocity.x
      this.velocity.z = newHorizontalVelocity.z
    } else {
      this.velocity.x *= tangentialDamping
      this.velocity.z *= tangentialDamping
    }

    this.angularVelocity.multiplyScalar(spinDamping)

    if (this.motionState === 'airborne') {
      this.resolveTerrainCollision()
    } else {
      this.placeOnTerrain()
    }

    if (this.velocity.length() <= this.getGameplayStopSpeed()) {
      this.stop()
    } else if (this.motionState === 'resting') {
      this.motionState = 'grounded'
      this._isActive = true
    }

    return true
  }

  /** Keeps the ball inside the generated map by bouncing it off the square border. */
  private resolveBoundaryCollision(): void {
    if (this.boundaryHalfSize === null || this.boundaryHalfSize <= 0) {
      return
    }

    const limit = Math.max(0, this.boundaryHalfSize - this.config.radius)
    let bounced = false

    if (this.position.x < -limit) {
      this.position.x = -limit
      if (this.velocity.x < 0) {
        this.velocity.x = -this.velocity.x * this.config.restitution
        bounced = true
      }
    } else if (this.position.x > limit) {
      this.position.x = limit
      if (this.velocity.x > 0) {
        this.velocity.x = -this.velocity.x * this.config.restitution
        bounced = true
      }
    }

    if (this.position.z < -limit) {
      this.position.z = -limit
      if (this.velocity.z < 0) {
        this.velocity.z = -this.velocity.z * this.config.restitution
        bounced = true
      }
    } else if (this.position.z > limit) {
      this.position.z = limit
      if (this.velocity.z > 0) {
        this.velocity.z = -this.velocity.z * this.config.restitution
        bounced = true
      }
    }

    const contactHeight = this.getContactHeight(
      this.terrain.getSurfaceNormalAt(this.position.x, this.position.z)
    )
    if (this.position.y < contactHeight || this.motionState !== 'airborne') {
      this.position.y = contactHeight
    }

    if (bounced) {
      this.angularVelocity.multiplyScalar(0.7)
      if (this.velocity.length() <= this.config.stopSpeed) {
        this.stop()
      } else if (this.motionState === 'resting') {
        this.motionState = 'grounded'
        this._isActive = true
      }
    }
  }

  private integrateRotation(deltaTime: number): void {
    this.rollingRotation.x += this.angularVelocity.x * deltaTime
    this.rollingRotation.y += this.angularVelocity.y * deltaTime
    this.rollingRotation.z += this.angularVelocity.z * deltaTime
  }

  /**
   * Gives the ball a stable resting state once it is visually stopped.
   * Numerical physics can keep producing tiny slope/friction/spin oscillations,
   * so this works like the sleep threshold used by most physics engines.
   */
  private updateSleepState(deltaTime: number): void {
    if (this.motionState !== 'grounded') {
      this.nearRestTime = 0
      return
    }

    if (this.velocity.length() <= this.getGameplayStopSpeed()) {
      this.nearRestTime += deltaTime
      this.velocity.multiplyScalar(0.82)
      this.angularVelocity.multiplyScalar(0.82)

      if (this.nearRestTime >= this.restHoldDuration) {
        this.stop()
      }
      return
    }

    this.nearRestTime = 0
  }

  private getGameplayStopSpeed(): number {
    return Math.max(this.config.stopSpeed, 0.05)
  }

  /**
   * Applies a physically calculated club-head collision to the ball.
   * A lofted face normal gives the ball an upward launch component.
   */
  hitByClub(input: ClubImpactInput): ClubImpactResult {
    this.nearRestTime = 0

    if (this.motionState === 'resting') {
      this.placeOnTerrain()
    }

    const result = ClubImpact.resolve(
      this.config.mass,
      this.config.radius,
      this.velocity,
      this.angularVelocity,
      input
    )

    if (result.didHit) {
      this.velocity.copy(result.linearVelocity)
      this.angularVelocity.copy(result.angularVelocity)
      this.nearRestTime = 0
      this.motionState = this.velocity.y > this.config.bounceSpeed ? 'airborne' : 'grounded'
      this._isActive = true
    }

    return result
  }

  /**
   * Backward-compatible direct launch helper. New gameplay code should prefer
   * hitByClub(), which derives launch velocity from a club-ball impulse.
   */
  swing(direction: THREE.Vector3, launchSpeed: number): void {
    if (direction.lengthSq() === 0 || launchSpeed <= 0) {
      return
    }
    this.nearRestTime = 0
    if (this.motionState === 'resting') {
      this.placeOnTerrain()
    }

    this.velocity.copy(direction).normalize().multiplyScalar(launchSpeed)
    this.nearRestTime = 0
    this.motionState = this.velocity.y > this.config.bounceSpeed ? 'airborne' : 'grounded'
    this._isActive = true
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone()
  }

  getVelocity(): THREE.Vector3 {
    return this.velocity.clone()
  }

  getAngularVelocity(): THREE.Vector3 {
    return this.angularVelocity.clone()
  }

  getRotation(): THREE.Euler {
    return this.rollingRotation.clone()
  }

  getMotionState(): BallMotionState {
    return this.motionState
  }

  isActive(): boolean {
    return this._isActive
  }

  canBeHit(): boolean {
    return (
      this.motionState === 'resting' ||
      (this.motionState === 'grounded' && this.velocity.length() <= this.getGameplayStopSpeed())
    )
  }

  settleForHit(): boolean {
    if (!this.canBeHit()) {
      return false
    }

    this.stop()
    return true
  }

  getRadius(): number {
    return this.config.radius
  }

  getMass(): number {
    return this.config.mass
  }

  getConfig(): Readonly<BallPhysicsConfig> {
    return this.config
  }

  setBoundaryHalfSize(halfSize: number | null): void {
    this.boundaryHalfSize = halfSize === null ? null : Math.max(0, halfSize)
    this.resolveBoundaryCollision()
  }

  updateConfig(config: Partial<BallPhysicsConfig>): void {
    const previousRadius = this.config.radius

    Object.assign(this.config, {
      ...config,
      windVelocity: config.windVelocity?.clone() ?? this.config.windVelocity,
    })

    this.validateConfiguration()
    this.crossSectionArea = Math.PI * this.config.radius * this.config.radius

    if (this.config.radius !== previousRadius && !this._isActive) {
      this.placeOnTerrain()
    }
  }

  applyShotSpin(
    horizontalDirection: THREE.Vector3,
    spinPercent: number,
    sideSpinPercent: number
  ): void {
    const direction = new THREE.Vector3(horizontalDirection.x, 0, horizontalDirection.z)
    if (direction.lengthSq() === 0) {
      return
    }

    direction.normalize()
    const upAxis = new THREE.Vector3(0, 1, 0)
    const topSpinAxis = direction.clone().cross(upAxis).normalize()
    const maximumSpin = 300
    const maximumSideSpin = 120

    this.angularVelocity.addScaledVector(
      topSpinAxis,
      (-THREE.MathUtils.clamp(spinPercent, -100, 100) * maximumSpin) / 100
    )
    this.angularVelocity.addScaledVector(
      upAxis,
      (THREE.MathUtils.clamp(sideSpinPercent, -100, 100) * maximumSideSpin) / 100
    )
  }

  alignToTerrain(): void {
    if (!this._isActive) {
      this.placeOnTerrain()
    }
  }

  reset(): void {
    super.reset()
    this.nearRestTime = 0
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.rollingRotation.set(0, 0, 0)
    this.motionState = 'resting'
    this._isActive = false
    this.placeOnTerrain()
  }

  private stop(): void {
    this.nearRestTime = 0
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.motionState = 'resting'
    this._isActive = false
    this.placeOnTerrain()
  }

  private placeOnTerrain(): void {
    const normal = this.terrain.getSurfaceNormalAt(this.position.x, this.position.z)
    this.position.y = this.getContactHeight(normal)
  }

  private getContactHeight(normal: THREE.Vector3): number {
    const groundHeight = this.terrain.getHeightAt(this.position.x, this.position.z)
    return groundHeight + this.config.radius / Math.max(normal.y, 0.2)
  }

  private validateConfiguration(): void {
    if (
      this.config.radius <= 0 ||
      this.config.mass <= 0 ||
      this.config.gravity <= 0 ||
      this.config.airDensity < 0 ||
      this.config.dragCoefficient < 0 ||
      this.config.magnusCoefficient < 0 ||
      this.config.maximumLiftCoefficient < 0 ||
      this.config.restitution < 0 ||
      this.config.restitution > 1 ||
      this.config.impactFriction < 0 ||
      this.config.slidingFriction < 0 ||
      this.config.rollingResistance < 0 ||
      this.config.slopeStrength < 0 ||
      this.config.stopSpeed < 0 ||
      this.config.bounceSpeed < 0 ||
      this.config.simulationStep <= 0 ||
      this.config.maximumDeltaTime <= 0
    ) {
      throw new Error('Invalid ball physics configuration')
    }
  }
}
