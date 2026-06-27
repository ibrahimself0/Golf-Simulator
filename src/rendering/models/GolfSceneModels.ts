import * as THREE from 'three'
import type { GreenTerrain } from '../../domain/physics/GreenTerrain'
import { BallModel } from './BallModel'
import { ClubModel } from './ClubModel'
import { HoleModel } from './HoleModel'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'


export class GolfSceneModels {
  private readonly root = new THREE.Group()
  readonly ball: BallModel
  readonly club: ClubModel
  readonly hole: HoleModel
  private loader = new GLTFLoader()
  private treeModels: THREE.Object3D[] = []
  private loadedTrees = 0
  private readonly TOTAL_TREES = 3

  constructor(terrain: GreenTerrain, physicalBallRadius: number) {
    this.root.name = 'golf-scene-models'

    this.ball = new BallModel({ physicalRadius: physicalBallRadius })
    this.club = new ClubModel()
    this.hole = new HoleModel()

    this.root.add(this.ball.getObject3D(), this.club.getObject3D(), this.hole.getObject3D())

    const start = new THREE.Vector3(0, terrain.getHeightAt(0, 0) + physicalBallRadius, 0)
    this.ball.sync(start, new THREE.Euler())

    this.club.place(new THREE.Vector3(0.34, terrain.getHeightAt(0.34, 0.25), 0.25))
    /*{x: 0, y: -0.2668833415170805, z: -57.572032036151114}*/
    const holeX = 0
    const holeZ = -57.57;
    this.hole.place(new THREE.Vector3(holeX, terrain.getHeightAt(holeX, holeZ), holeZ))

    this.loader.load('/models/character-male-d.glb', (gltf) => {
      const character = gltf.scene

      character.position.set(1.5, terrain.getHeightAt(1.5, 1), 1)

      character.rotation.set(0, 3.1, 0)
      character.scale.set(3, 3, 3)

      this.root.add(character)
    })
    this.loader.load('/models/GLB format/building-e.glb', (gltf) => {
      const character = gltf.scene

      character.position.set(50, terrain.getHeightAt(50, 50), 50)
      character.scale.set(10, 10, 10)
      this.root.add(character)
    })
    this.loader.load('/models/GLB format/building-k.glb', (gltf) => {
      const character = gltf.scene

      character.position.set(30, terrain.getHeightAt(30, 50), 50)
      character.scale.set(10, 10, 10)
      this.root.add(character)
    })
    this.loader.load('/models/GLB format/building-m.glb', (gltf) => {
      const character = gltf.scene

      character.position.set(65, terrain.getHeightAt(30, 50), 30)
      character.scale.set(10, 10, 10)
      character.rotation.set(0, -1.5, 0)
      this.root.add(character)
    })
    this.loader.load('/models/GLB format/building-n.glb', (gltf) => {
      const character = gltf.scene

      character.position.set(65, terrain.getHeightAt(30, 50), 5)
      character.scale.set(10, 10, 10)
      character.rotation.set(0, -1.5, 0)
      this.root.add(character)
    })
    this.loadTreeModels(terrain)
  }

  private generateTrees(terrain: GreenTerrain, frequency: number): void {
    const resolution = terrain.getResolution()
    const cellSize = terrain.getCellSize()

    const worldSize = resolution * cellSize
    const half = worldSize / 2

    const forestStartZ = -half
    const forestEndZ = -half * 0.7
    for (let i = 0; i < resolution * resolution; i++) {
      if (Math.random() > frequency) continue

      const x = Math.random() * worldSize - half
      const z = forestStartZ + Math.random() * (forestEndZ - forestStartZ)

      const y = terrain.getHeightAt(x, z)

      const tree = this.createTree()

      tree.position.set(x, y, z)

      const scale = 0.8 + Math.random() * 10
      tree.scale.set(scale, scale, scale)

      this.root.add(tree)
    }
  }
  private loadTreeModels(terrain: GreenTerrain): void {
    const paths = [
      '/models/tree_oak_dark.glb',
      '/models/rock_largeA.glb',
      '/models/tree_pineDefaultA.glb',
    ]

    paths.forEach((path) => {
      this.loader.load(path, (gltf) => {
        const model = gltf.scene

        this.treeModels.push(model)

        this.loadedTrees++

        if (this.loadedTrees === this.TOTAL_TREES) {
          this.generateTrees(terrain, 0.0001)
        }
      })
    })
  }
  private createTree(): THREE.Object3D {
    const type = Math.floor(Math.random() * this.treeModels.length)

    const original = this.treeModels[type]

    if (!original) {
      return new THREE.Group()
    }

    return original.clone(true)
  }

  syncBall(position: THREE.Vector3, rotation: THREE.Euler): void {
    this.ball.sync(position, rotation)
  }

  getObject3D(): THREE.Group {
    return this.root
  }

  dispose(): void {
    this.ball.dispose()
    this.club.dispose()
    this.hole.dispose()
    this.root.clear()
  }
}
