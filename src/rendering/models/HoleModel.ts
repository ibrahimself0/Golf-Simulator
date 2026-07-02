import * as THREE from 'three'
import { BaseVisualModel } from './abstracts/BaseVisualModel'

const FLAG_OFFSET = new THREE.Vector3(0.72, 0, 0.18)

/** Simple hole, side pole and larger flag grouped as one replaceable model. */
export class HoleModel extends BaseVisualModel {
  constructor() {
    super('hole-model')

    const hole = new THREE.Group()
    const cup = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 40),
      new THREE.MeshBasicMaterial({ color: 0x101510, side: THREE.DoubleSide })
    )
    cup.rotation.x = -Math.PI / 2
    cup.position.y = 0.008

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.018, 8, 42),
      new THREE.MeshStandardMaterial({ color: 0xf2f2e8, roughness: 0.75 })
    )
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.018

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.65, 12),
      new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.55 })
    )
    pole.position.set(FLAG_OFFSET.x, 1.325, FLAG_OFFSET.z)

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.52),
      new THREE.MeshStandardMaterial({
        color: 0xe53935,
        roughness: 0.8,
        side: THREE.DoubleSide,
      })
    )
    flag.position.set(FLAG_OFFSET.x + 0.49, 2.35, FLAG_OFFSET.z)

    pole.castShadow = true
    flag.castShadow = true
    rim.receiveShadow = true
    hole.add(cup, rim, pole, flag)
    this.usePlaceholder(hole)
  }

  place(position: THREE.Vector3): void {
    this.root.position.copy(position)
  }
}
