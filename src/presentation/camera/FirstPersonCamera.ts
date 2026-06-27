import * as THREE from 'three'
import { InputHandler } from '../input/InputHandler'
import { BaseCamera } from './abstracts/BaseCamera'

/** A free-flying spectator camera. It never reads from or writes to game physics. */
export class FirstPersonCamera extends BaseCamera {
  private readonly input: InputHandler
  private readonly initialPosition: THREE.Vector3
  private readonly moveSpeed = 7
  private readonly lookSensitivity = 0.002
  private readonly maxPitch = Math.PI / 2 - 0.01
  private yaw = 0
  private pitch = -0.18
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

  /** Move in camera-relative horizontal directions, with explicit vertical flight. */
  update(deltaTime: number): void {
    if (!this.input.isPointerLocked()) {
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
      this.position.addScaledVector(
        this.movement.normalize(),
        this.moveSpeed * frameTime
      )
    }

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
    this.updateTarget()
  }

  dispose(): void {
    this.unsubscribeMouseMove()
  }
}
