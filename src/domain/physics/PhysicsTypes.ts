import * as THREE from 'three'

/** The three useful phases of a golf ball's motion. */
export type BallMotionState = 'resting' | 'airborne' | 'grounded'

/**
 * Physical values use SI units: metres, seconds, kilograms and newtons.
 * The defaults describe a regulation golf ball on short grass.
 */
export interface BallPhysicsConfig {
  radius: number
  mass: number
  gravity: number
  airDensity: number
  dragCoefficient: number
  magnusCoefficient: number
  maximumLiftCoefficient: number
  restitution: number
  impactFriction: number
  slidingFriction: number
  rollingResistance: number
  slopeStrength: number
  stopSpeed: number
  bounceSpeed: number
  maximumDeltaTime: number
  simulationStep: number
  windVelocity: THREE.Vector3
}

export const DEFAULT_BALL_PHYSICS: Readonly<BallPhysicsConfig> = {
  radius: 0.02135,
  mass: 0.04593,
  gravity: 9.81,
  airDensity: 1.225,
  dragCoefficient: 0.25,
  magnusCoefficient: 0.6,
  maximumLiftCoefficient: 0.3,
  restitution: 0.45,
  impactFriction: 0.2,
  slidingFriction: 0.25,
  rollingResistance: 0.04,
  slopeStrength: 1,
  stopSpeed: 0.03,
  bounceSpeed: 0.35,
  maximumDeltaTime: 0.05,
  simulationStep: 1 / 240,
  windVelocity: new THREE.Vector3(),
}

/** Input measured at the instant the club face touches the ball. */
export interface ClubImpactInput {
  clubHeadVelocity: THREE.Vector3
  faceNormal: THREE.Vector3
  effectiveClubMass?: number
  restitution?: number
  friction?: number
}

/** Result of the short club-ball collision. */
export interface ClubImpactResult {
  didHit: boolean
  impulse: THREE.Vector3
  linearVelocity: THREE.Vector3
  angularVelocity: THREE.Vector3
}
