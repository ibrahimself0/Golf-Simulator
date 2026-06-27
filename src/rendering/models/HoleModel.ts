import * as THREE from 'three'
import { BaseVisualModel } from './abstracts/BaseVisualModel'

/** Simple hole, pole and flag grouped as one replaceable model. */
export class HoleModel extends BaseVisualModel {
  constructor() {
    super('hole-model')

    const hole = new THREE.Group()
    const cup = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 24),
      new THREE.MeshBasicMaterial({ color: 0x182018, side: THREE.DoubleSide })
    )
    cup.rotation.x = -Math.PI / 2
    cup.position.y = 0.006

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.7, 10),
      new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.6 })
    )
    pole.position.y = 0.85

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.3),
      new THREE.MeshStandardMaterial({
        color: 0xe53935,
        roughness: 0.8,
        side: THREE.DoubleSide,
      })
    )
    flag.position.set(0.285, 1.5, 0)

    pole.castShadow = true
    flag.castShadow = true
    hole.add(cup, pole, flag)
    this.usePlaceholder(hole)
  }

  place(position: THREE.Vector3): void {
    this.root.position.copy(position)
  }
}
