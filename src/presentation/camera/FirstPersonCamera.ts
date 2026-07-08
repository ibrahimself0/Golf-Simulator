import * as THREE from 'three'
import { GreenTerrain } from '../../domain/physics/GreenTerrain'
import { InputHandler } from '../input/InputHandler'
import { BaseCamera } from './abstracts/BaseCamera'

export class FirstPersonCamera extends BaseCamera {
  private readonly input: InputHandler
  private readonly initialPosition: THREE.Vector3
  private readonly moveSpeed = 7
  private readonly lookSensitivity = 0.002
  private readonly maxPitch = Math.PI / 2 - 0.01
  private yaw = 0
  private pitch = -0.18
  private terrain: GreenTerrain | null = null
  private minimumGroundClearance = 1.1
  private borderMargin = 2
  private readonly forward = new THREE.Vector3()
  private readonly right = new THREE.Vector3()
  private readonly movement = new THREE.Vector3()
  private readonly unsubscribeMouseMove: () => void

  constructor(
    input: InputHandler,
    initialPosition: THREE.Vector3 = new THREE.Vector3(0, 4, 10)
  ) {
    super(initialPosition)
    this.input = input
    this.initialPosition = initialPosition.clone()
    this.unsubscribeMouseMove = this.input.onMouseMove((deltaX, deltaY) => {
      this.look(deltaX, deltaY)
    })
    this.updateTarget()
  }

  update(deltaTime: number): void {
    if (!this.input.isPointerLocked()) {
      this.applyBounds()
      this.updateTarget()
      return
    }

    const frameTime = Math.min(Math.max(deltaTime, 0), 0.1)
    this.forward.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    this.right.set(Math.cos(this.yaw), 0, Math.sin(this.yaw))
    this.movement.set(0, 0, 0)

    if (this.isAnyPressed('w', 'arrowup')) this.movement.add(this.forward)
    if (this.isAnyPressed('s', 'arrowdown')) this.movement.sub(this.forward)
    if (this.isAnyPressed('d', 'arrowright')) this.movement.add(this.right)
    if (this.isAnyPressed('a', 'arrowleft')) this.movement.sub(this.right)
    if (this.input.isKeyPressed('space')) this.movement.y += 1
    if (this.input.isKeyPressed('shift')) this.movement.y -= 1

    if (this.movement.lengthSq() > 0) {
      this.position.addScaledVector(this.movement.normalize(), this.moveSpeed * frameTime)
    }

    this.applyBounds()
    this.updateTarget()
  }

  setTerrainConstraint(terrain: GreenTerrain, minimumGroundClearance = 1.1, borderMargin = 2): void {
    this.terrain = terrain
    this.minimumGroundClearance = minimumGroundClearance
    this.borderMargin = borderMargin
    this.applyBounds()
    this.updateTarget()
  }

  setPose(position: THREE.Vector3, target: THREE.Vector3): void {
    this.position.copy(position)
    const direction = target.clone().sub(position)
    if (direction.lengthSq() > 0) {
      direction.normalize()
      this.yaw = Math.atan2(direction.x, -direction.z)
      this.pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))
    }
    this.applyBounds()
    this.updateTarget()
  }

  private look(deltaX: number, deltaY: number): void {
    this.yaw += deltaX * this.lookSensitivity
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - deltaY * this.lookSensitivity,
      -this.maxPitch,
      this.maxPitch
    )
    this.updateTarget()
  }

  private applyBounds(): void {
    if (!this.terrain) {
      return
    }

    const half = this.terrain.getSize() / 2 - this.borderMargin
    this.position.x = THREE.MathUtils.clamp(this.position.x, -half, half)
    this.position.z = THREE.MathUtils.clamp(this.position.z, -half, half)
    const ground = this.terrain.getHeightAt(this.position.x, this.position.z)
    this.position.y = Math.max(this.position.y, ground + this.minimumGroundClearance)
  }

  private updateTarget(): void {
    const cosPitch = Math.cos(this.pitch)
    this.target.set(
      this.position.x + Math.sin(this.yaw) * cosPitch,
      this.position.y + Math.sin(this.pitch),
      this.position.z - Math.cos(this.yaw) * cosPitch
    )
  }

  private isAnyPressed(...keys: string[]): boolean {
    return keys.some((key) => this.input.isKeyPressed(key))
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone()
  }

  getTarget(): THREE.Vector3 {
    return this.target.clone()
  }

  reset(): void {
    this.position.copy(this.initialPosition)
    this.yaw = 0
    this.pitch = -0.18
    this.applyBounds()
    this.updateTarget()
  }

  dispose(): void {
    this.unsubscribeMouseMove()
  }
}
