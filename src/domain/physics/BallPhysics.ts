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

export class BallPhysics extends BasePhysicsObject {
  private readonly terrain: GreenTerrain
  private readonly config: BallPhysicsConfig
  private readonly crossSectionArea: number
  private angularVelocity = new THREE.Vector3()
  private rollingRotation = new THREE.Euler()
  private motionState: BallMotionState = 'resting'

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
      this.integrateRotation(step)
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
    const slopeAcceleration = gravity.clone().addScaledVector(normal, -gravity.dot(normal))
    const resistanceMagnitude = this.config.rollingResistance * this.config.gravity
    const groundSpeed = this.velocity.length()
    const previousVelocity = this.velocity.clone()
    const contactOffset = normal.clone().multiplyScalar(-this.config.radius)
    const contactVelocity = this.velocity
      .clone()
      .add(this.angularVelocity.clone().cross(contactOffset))
    const slipVelocity = contactVelocity.addScaledVector(
      normal,
      -contactVelocity.dot(normal)
    )
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

      const inertia =
        (2 / 5) * this.config.mass * this.config.radius * this.config.radius
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
      slopeAcceleration.addScaledVector(
        slopeAcceleration.clone().normalize(),
        -resistanceMagnitude
      )
    } else {
      slopeAcceleration.addScaledVector(
        this.velocity.clone().normalize(),
        -resistanceMagnitude
      )
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
    console.log('Ball hit terrain at:', {
      x: this.position.x,
      y: contactHeight,
      z: this.position.z,
    })
    const normalSpeed = this.velocity.dot(normal)
    if (normalSpeed >= 0) {
      return
    }

    const contactOffset = normal.clone().multiplyScalar(-this.config.radius)
    const contactVelocity = this.velocity
      .clone()
      .add(this.angularVelocity.clone().cross(contactOffset))
    const slipVelocity = contactVelocity.addScaledVector(
      normal,
      -contactVelocity.dot(normal)
    )
    const inertia =
      (2 / 5) * this.config.mass * this.config.radius * this.config.radius
    const inverseTangentialMass =
      1 / this.config.mass +
      (this.config.radius * this.config.radius) / inertia
    const frictionImpulse = slipVelocity.multiplyScalar(-1 / inverseTangentialMass)
    const normalImpulseMagnitude =
      this.config.mass * (1 + this.config.restitution) * -normalSpeed
    const maximumFrictionImpulse = this.config.impactFriction * normalImpulseMagnitude
    if (frictionImpulse.length() > maximumFrictionImpulse) {
      frictionImpulse.setLength(maximumFrictionImpulse)
    }

    this.velocity.addScaledVector(frictionImpulse, 1 / this.config.mass)
    this.angularVelocity.addScaledVector(
      contactOffset.clone().cross(frictionImpulse),
      1 / inertia
    )
    const reboundSpeed = -normalSpeed * this.config.restitution
    this.velocity.addScaledVector(normal, (1 + this.config.restitution) * -normalSpeed)

    if (reboundSpeed > this.config.bounceSpeed) {
      this.motionState = 'airborne'
    } else {
      this.velocity.addScaledVector(normal, -this.velocity.dot(normal))
      this.motionState = 'grounded'
    }
  }

  private integrateRotation(deltaTime: number): void {
    this.rollingRotation.x += this.angularVelocity.x * deltaTime
    this.rollingRotation.y += this.angularVelocity.y * deltaTime
    this.rollingRotation.z += this.angularVelocity.z * deltaTime
  }

  /**
   * Applies a physically calculated club-head collision to the ball.
   * A lofted face normal gives the ball an upward launch component.
   */
  hitByClub(input: ClubImpactInput): ClubImpactResult {
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
    if (this.motionState === 'resting') {
      this.placeOnTerrain()
    }

    this.velocity.copy(direction).normalize().multiplyScalar(launchSpeed)
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

  getRadius(): number {
    return this.config.radius
  }

  getMass(): number {
    return this.config.mass
  }

  reset(): void {
    super.reset()
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.rollingRotation.set(0, 0, 0)
    this.motionState = 'resting'
    this._isActive = false
    this.placeOnTerrain()
  }

  private stop(): void {
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
      this.config.stopSpeed < 0 ||
      this.config.bounceSpeed < 0 ||
      this.config.simulationStep <= 0 ||
      this.config.maximumDeltaTime <= 0
    ) {
      throw new Error('Invalid ball physics configuration')
    }
  }
}
