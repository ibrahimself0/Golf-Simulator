import * as THREE from 'three'
import { GreenTerrain } from '../../domain/physics/GreenTerrain'
import { InputHandler } from '../input/InputHandler'
import { BaseCamera } from './abstracts/BaseCamera'

export class OrbitCamera extends BaseCamera {
  private readonly input: InputHandler
  private terrain: GreenTerrain | null = null
  private focus = new THREE.Vector3()
  private yaw = Math.PI * 0.2
  private pitch = -0.48
  private distance = 13
  private readonly lookSensitivity = 0.004
  private readonly zoomSensitivity = 0.018
  private readonly minPitch = -1.1
  private readonly maxPitch = -0.12
  private readonly minDistance = 5
  private readonly maxDistance = 38
  private readonly unsubscribeMouseMove: () => void
  private readonly unsubscribeWheel: () => void

  constructor(input: InputHandler, focus: THREE.Vector3 = new THREE.Vector3()) {
    super(new THREE.Vector3(0, 7, 13), focus)
    this.input = input
    this.focus.copy(focus)
    this.unsubscribeMouseMove = this.input.onMouseMove((deltaX, deltaY) => {
      this.yaw += deltaX * this.lookSensitivity
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + deltaY * this.lookSensitivity,
        this.minPitch,
        this.maxPitch
      )
      this.updatePosition()
    })
    this.unsubscribeWheel = this.input.onWheel((deltaY) => {
      this.distance = THREE.MathUtils.clamp(
        this.distance + deltaY * this.zoomSensitivity,
        this.minDistance,
        this.maxDistance
      )
      this.updatePosition()
    })
    this.updatePosition()
  }

  update(_deltaTime: number, focus?: THREE.Vector3): void {
    if (focus) {
      this.focus.copy(focus)
    }
    this.updatePosition()
  }

  setTerrainConstraint(terrain: GreenTerrain): void {
    this.terrain = terrain
    this.updatePosition()
  }

  setFocus(focus: THREE.Vector3): void {
    this.focus.copy(focus)
    this.updatePosition()
  }

  setPose(position: THREE.Vector3, focus: THREE.Vector3): void {
    this.focus.copy(focus)
    const offset = position.clone().sub(focus)
    const horizontal = Math.hypot(offset.x, offset.z)
    this.distance = THREE.MathUtils.clamp(offset.length(), this.minDistance, this.maxDistance)
    if (horizontal > 0.001) {
      this.yaw = Math.atan2(offset.x, offset.z)
    }
    if (offset.lengthSq() > 0.001) {
      this.pitch = THREE.MathUtils.clamp(Math.atan2(offset.y, horizontal), this.minPitch, this.maxPitch)
    }
    this.updatePosition()
  }

  private updatePosition(): void {
    const horizontal = Math.cos(this.pitch) * this.distance
    this.position.set(
      this.focus.x + Math.sin(this.yaw) * horizontal,
      this.focus.y + Math.sin(this.pitch) * this.distance + 5.2,
      this.focus.z + Math.cos(this.yaw) * horizontal
    )
    this.target.copy(this.focus)
    this.applyBounds()
  }

  private applyBounds(): void {
    if (!this.terrain) {
      return
    }

    const half = this.terrain.getSize() / 2 - 2
    this.position.x = THREE.MathUtils.clamp(this.position.x, -half, half)
    this.position.z = THREE.MathUtils.clamp(this.position.z, -half, half)
    const ground = this.terrain.getHeightAt(this.position.x, this.position.z)
    this.position.y = Math.max(this.position.y, ground + 1.1)
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone()
  }

  getTarget(): THREE.Vector3 {
    return this.target.clone()
  }

  reset(): void {
    this.yaw = Math.PI * 0.2
    this.pitch = -0.48
    this.distance = 13
    this.updatePosition()
  }

  dispose(): void {
    this.unsubscribeMouseMove()
    this.unsubscribeWheel()
  }
}
