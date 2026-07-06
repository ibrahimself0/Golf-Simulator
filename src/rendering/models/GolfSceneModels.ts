import * as THREE from 'three'
import { GreenTerrain } from '../../domain/physics/GreenTerrain'
import { BallModel } from './BallModel'
import { ClubModel } from './ClubModel'
import { HoleModel } from './HoleModel'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class GolfSceneModels {
  private readonly root = new THREE.Group()
  readonly ball: BallModel
  readonly club: ClubModel
  readonly hole: HoleModel
  private readonly terrain: GreenTerrain
  private readonly loader = new GLTFLoader()
  private readonly treeModels: THREE.Object3D[] = []
  private readonly proceduralTrees: THREE.Object3D[] = []
  private loadedTrees = 0
  private readonly TOTAL_TREE_MODELS = 3
  private physicalBallRadius: number
  private plane?: THREE.Object3D
  private mountain?: THREE.Object3D
  private island?: THREE.Object3D

  public getPlane(): THREE.Object3D | undefined {
    return this.plane
  }

  constructor(terrain: GreenTerrain, physicalBallRadius: number) {
    this.terrain = terrain
    this.physicalBallRadius = physicalBallRadius
    this.root.name = 'golf-scene-models'

    this.ball = new BallModel({ physicalRadius: physicalBallRadius })
    this.club = new ClubModel()
    this.hole = new HoleModel()

    this.root.add(this.ball.getObject3D(), this.club.getObject3D(), this.hole.getObject3D())
    this.placeCourseObjects()
    this.loadDistantScenery()
    this.loadPlane()
    this.loadTreeModels()
  }

  refreshForTerrain(): void {
    this.placeCourseObjects()
    this.placeDistantScenery()
    this.refreshProceduralTrees()
  }

  private placeCourseObjects(): void {
    const startPoint = this.terrain.getStartPosition()
    const start = new THREE.Vector3(
      startPoint.x,
      this.terrain.getHeightAt(startPoint.x, startPoint.y) + this.physicalBallRadius,
      startPoint.y
    )
    this.ball.sync(start, new THREE.Euler())
    this.club.place(new THREE.Vector3(startPoint.x + 0.34, this.terrain.getHeightAt(startPoint.x + 0.34, startPoint.y + 0.25), startPoint.y + 0.25))

    const holePoint = this.terrain.getHolePosition()
    this.hole.place(
      new THREE.Vector3(
        holePoint.x,
        this.terrain.getHeightAt(holePoint.x, holePoint.y),
        holePoint.y
      )
    )
  }

  private loadDistantScenery(): void {
    this.loader.load('/models/low_poly_mountain_free.glb', (gltf) => {
      this.mountain = gltf.scene
      this.mountain.scale.set(65, 65, 65)
      this.mountain.rotation.set(0, -1.5, 0)
      this.placeDistantScenery()
      this.root.add(this.mountain)
    })

    this.loader.load('/models/fairy_island.glb', (gltf) => {
      this.island = gltf.scene
      this.island.scale.set(8, 8, 8)
      this.island.rotation.set(0, 3, 0)
      this.placeDistantScenery()
      this.root.add(this.island)
    })
  }

  private placeDistantScenery(): void {
    const halfSize = this.terrain.getSize() / 2
    if (this.mountain) {
      this.mountain.position.set(halfSize + 140, -22, -halfSize * 0.45)
    }
    if (this.island) {
      this.island.position.set(-halfSize - 120, 34, halfSize + 70)
    }
  }

  private loadPlane(): void {
    this.loader.load('/models/cartoon_plane.glb', (gltf) => {
      this.plane = gltf.scene
      this.plane.position.set(-65, 50, -50)
      this.plane.scale.set(7, 7, 7)
      this.plane.rotation.set(0, 3, 0)
      this.root.add(this.plane)
    })
  }

  private loadTreeModels(): void {
    const paths = [
      '/models/tree_oak_dark.glb',
      '/models/tree_pineDefaultA.glb',
      '/models/tree_palm.glb',
    ]

    paths.forEach((path) => {
      this.loader.load(path, (gltf) => {
        this.treeModels.push(gltf.scene)
        this.loadedTrees++

        if (this.loadedTrees === this.TOTAL_TREE_MODELS) {
          this.refreshProceduralTrees()
        }
      })
    })
  }

  private refreshProceduralTrees(): void {
    this.clearProceduralTrees()
    if (this.loadedTrees < this.TOTAL_TREE_MODELS) {
      return
    }

    for (const instance of this.terrain.getTreeInstances()) {
      const original = this.treeModels[instance.typeIndex % this.treeModels.length]
      if (!original) {
        continue
      }

      const tree = original.clone(true)
      const y = this.terrain.getHeightAt(instance.x, instance.z)
      tree.position.set(instance.x, y, instance.z)
      tree.rotation.set(0, instance.rotationY, 0)
      tree.scale.setScalar(instance.scale)
      this.proceduralTrees.push(tree)
      this.root.add(tree)
    }
  }

  private clearProceduralTrees(): void {
    for (const tree of this.proceduralTrees) {
      this.root.remove(tree)
    }
    this.proceduralTrees.length = 0
  }

  syncGolfer(ballPosition: THREE.Vector3, shotDirection: THREE.Vector3): void {
    const forward = new THREE.Vector3(shotDirection.x, 0, shotDirection.z)
    if (forward.lengthSq() === 0) {
      return
    }

    forward.normalize()
    this.club.placeForShot(
      ballPosition,
      this.terrain.getHeightAt(ballPosition.x, ballPosition.z),
      forward
    )
  }

  syncBall(position: THREE.Vector3, rotation: THREE.Euler): void {
    this.ball.sync(position, rotation)
  }

  setBallPhysicalRadius(radius: number): void {
    this.physicalBallRadius = radius
    this.ball.setPhysicalRadius(radius)
  }

  getObject3D(): THREE.Group {
    return this.root
  }

  dispose(): void {
    this.ball.dispose()
    this.club.dispose()
    this.hole.dispose()
    this.clearProceduralTrees()
    this.root.clear()
  }
}
