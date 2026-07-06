import * as THREE from 'three'
import { BaseVisualModel } from './abstracts/BaseVisualModel'

/** A three-piece placeholder: shaft, grip and club head. */
export class ClubModel extends BaseVisualModel {
  constructor() {
    super('club-model')

    const club = new THREE.Group()
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.025, 1.25, 10),
      new THREE.MeshStandardMaterial({ color: 0xb8c1c7, metalness: 0.7, roughness: 0.35 })
    )
    shaft.position.y = 0.72

    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.03, 0.32, 10),
      new THREE.MeshStandardMaterial({ color: 0x1f2933, roughness: 0.9 })
    )
    grip.position.y = 1.49

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.55, roughness: 0.4 })
    )
    head.position.set(-0.11, 0.07, 0)

    for (const part of [shaft, grip, head]) {
      part.castShadow = true
      part.receiveShadow = true
      club.add(part)
    }

    this.usePlaceholder(club)
  }

  place(position: THREE.Vector3): void {
    this.root.position.copy(position)
    this.root.rotation.set(-0.42, 0.2, -0.22)
  }

  placeForShot(ballPosition: THREE.Vector3, terrainHeight: number, shotDirection: THREE.Vector3): void {
    const forward = new THREE.Vector3(shotDirection.x, 0, shotDirection.z)
    if (forward.lengthSq() === 0) {
      return
    }

    forward.normalize()
    const right = new THREE.Vector3(forward.z, 0, -forward.x)
    const position = ballPosition
      .clone()
      .addScaledVector(forward, -0.34)
      .addScaledVector(right, 0.42)
    position.y = terrainHeight + 0.03

    this.root.position.copy(position)
    this.root.rotation.y = Math.atan2(forward.x, forward.z) + Math.PI * 0.5
    this.root.rotation.z = -0.24
  }
}
