import * as THREE from 'three'
import type { ClubImpactInput, ClubImpactResult } from './PhysicsTypes'

const DEFAULT_EFFECTIVE_CLUB_MASS = 0.2
const DEFAULT_RESTITUTION = 0.78
const DEFAULT_FRICTION = 0.2

/**
 * Resolves the very short collision between a moving club head and a golf ball.
 *
 * The club is represented by its effective mass, face normal and contact
 * velocity. That is enough for ball flight; simulating the complete shaft and
 * golfer would add complexity without improving this project.
 */
export class ClubImpact {
  /** Converts a horizontal aim direction and club loft into a face normal. */
  static createFaceNormal(aimDirection: THREE.Vector3, loftDegrees: number): THREE.Vector3 {
    const horizontalAim = new THREE.Vector3(aimDirection.x, 0, aimDirection.z)
    if (horizontalAim.lengthSq() === 0) {
      throw new Error('Aim direction must have a horizontal component')
    }

    const loft = THREE.MathUtils.degToRad(loftDegrees)
    return horizontalAim
      .normalize()
      .multiplyScalar(Math.cos(loft))
      .add(new THREE.Vector3(0, Math.sin(loft), 0.5))
      .normalize()
  }

  static resolve(
    ballMass: number,
    ballRadius: number,
    ballVelocity: THREE.Vector3,
    ballAngularVelocity: THREE.Vector3,
    input: ClubImpactInput
  ): ClubImpactResult {
    if (ballMass <= 0 || ballRadius <= 0) {
      throw new Error('Ball mass and radius must be positive')
    }

    const normal = input.faceNormal.clone()
    if (normal.lengthSq() === 0 || input.clubHeadVelocity.lengthSq() === 0) {
      return this.noImpact(ballVelocity, ballAngularVelocity)
    }
    normal.normalize()

    const clubMass = input.effectiveClubMass ?? DEFAULT_EFFECTIVE_CLUB_MASS
    const restitution = input.restitution ?? DEFAULT_RESTITUTION
    const friction = input.friction ?? DEFAULT_FRICTION

    if (clubMass <= 0 || restitution < 0 || restitution > 1 || friction < 0) {
      throw new Error('Invalid club mass, restitution or friction')
    }

    // The face touches the point opposite its outward normal.
    const contactOffset = normal.clone().multiplyScalar(-ballRadius)
    const ballContactVelocity = ballVelocity
      .clone()
      .add(ballAngularVelocity.clone().cross(contactOffset))
    const relativeVelocity = input.clubHeadVelocity.clone().sub(ballContactVelocity)
    const closingSpeed = relativeVelocity.dot(normal)

    if (closingSpeed <= 0) {
      return this.noImpact(ballVelocity, ballAngularVelocity)
    }

    // Conservation of momentum with coefficient of restitution.
    const normalImpulseMagnitude =
      ((1 + restitution) * closingSpeed) / (1 / ballMass + 1 / clubMass)
    const normalImpulse = normal.clone().multiplyScalar(normalImpulseMagnitude)

    // Tangential impulse transfers some club-face motion into ball spin.
    const tangentialVelocity = relativeVelocity
      .clone()
      .sub(normal.clone().multiplyScalar(closingSpeed))
    const tangentSpeed = tangentialVelocity.length()
    const tangentialImpulse = new THREE.Vector3()

    if (tangentSpeed > 0) {
      const inertia = (2 / 5) * ballMass * ballRadius * ballRadius
      const tangentEffectiveMass = 1 / (1 / ballMass + ballRadius * ballRadius / inertia)
      const uncappedImpulse = tangentEffectiveMass * tangentSpeed
      const frictionLimit = friction * normalImpulseMagnitude
      tangentialImpulse
        .copy(tangentialVelocity)
        .normalize()
        .multiplyScalar(Math.min(uncappedImpulse, frictionLimit))
    }

    const impulse = normalImpulse.add(tangentialImpulse)
    const linearVelocity = ballVelocity.clone().addScaledVector(impulse, 1 / ballMass)
    const inertia = (2 / 5) * ballMass * ballRadius * ballRadius
    const angularVelocity = ballAngularVelocity
      .clone()
      .addScaledVector(contactOffset.clone().cross(tangentialImpulse), 1 / inertia)

    return {
      didHit: true,
      impulse,
      linearVelocity,
      angularVelocity,
    }
  }

  private static noImpact(
    linearVelocity: THREE.Vector3,
    angularVelocity: THREE.Vector3
  ): ClubImpactResult {
    return {
      didHit: false,
      impulse: new THREE.Vector3(),
      linearVelocity: linearVelocity.clone(),
      angularVelocity: angularVelocity.clone(),
    }
  }
}
