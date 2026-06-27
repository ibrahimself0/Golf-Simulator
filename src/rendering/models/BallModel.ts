import * as THREE from 'three'
import { BaseVisualModel } from './abstracts/BaseVisualModel'

export interface BallModelOptions {
  displayRadius: number
  physicalRadius: number
  color: THREE.ColorRepresentation
}

const DEFAULT_OPTIONS: BallModelOptions = {
  displayRadius: 0.14,
  physicalRadius: 0.02135,
  color: 0xffffff,
}

/** Simple visible ball. Its display size is independent from physics size. */
export class BallModel extends BaseVisualModel {
  private groundOffset: number

  constructor(options: Partial<BallModelOptions> = {}) {
    super('ball-model')
    const values = { ...DEFAULT_OPTIONS, ...options }
    this.groundOffset = Math.max(0, values.displayRadius - values.physicalRadius)

    const geometry = new THREE.SphereGeometry(values.displayRadius, 20, 14)
    const material = new THREE.MeshStandardMaterial({
      color: values.color,
      roughness: 0.65,
      metalness: 0,
    })
    const ball = new THREE.Mesh(geometry, material)
    ball.castShadow = true
    ball.receiveShadow = true
    this.usePlaceholder(ball)
  }

  sync(position: THREE.Vector3, rotation: THREE.Euler): void {
    this.root.position.copy(position)
    this.root.position.y += this.groundOffset
    this.root.rotation.copy(rotation)
  }

  /** Set to zero when a replacement model already has the correct physical size. */
  setGroundOffset(offset: number): void {
    this.groundOffset = offset
  }
}
