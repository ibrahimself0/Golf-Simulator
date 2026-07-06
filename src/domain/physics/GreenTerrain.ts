/**
 * Height-field terrain used by the physics simulation.
 *
 * The same continuous height and normal queries are used for collision,
 * bounce and downhill rolling, so the ball reacts consistently to the uneven
 * ground. No rendering objects are created here.
 */

import * as THREE from 'three'
import { Perlin } from '../../shared/utils/Perlin'

export interface GreenTerrainConfig {
  size: number
  resolution: number
  maximumHeight: number
  roughness: number
  seed: number
}

export interface WaterHazardPoint {
  x: number
  z: number
}

export interface WaterHazard {
  centerX: number
  centerZ: number
  waterLevel: number
  rotation: number
  outline: WaterHazardPoint[]
  boundsRadius: number
}

export interface TerrainTreeInstance {
  x: number
  z: number
  scale: number
  rotationY: number
  typeIndex: number
  /** Simple invisible cylinder collider used by ball physics. */
  colliderRadius: number
  colliderHeight: number
}

export interface FlagCollider {
  x: number
  z: number
  radius: number
  height: number
}

interface TerrainFeature {
  centerX: number
  centerZ: number
  radiusX: number
  radiusZ: number
  rotation: number
  strength: number
}

const COURSE_START = new THREE.Vector2(0, 0)
const DEFAULT_COURSE_HOLE = new THREE.Vector2(0, -64)
const START_PATCH_HEIGHT = 0.28
const HOLE_PATCH_HEIGHT = 0.36
const FLAG_OFFSET = new THREE.Vector2(0.72, 0.18)
const FLAG_COLLIDER_RADIUS = 0.055
const FLAG_COLLIDER_HEIGHT = 2.8

const DEFAULT_TERRAIN: Readonly<GreenTerrainConfig> = {
  size: 260,
  resolution: 640,
  maximumHeight: 8,
  roughness: 1,
  seed: 0,
}

/** Deterministic random generator so the same seed always recreates the course. */
function createSeededRandom(seed: number): () => number {
  let value = Math.trunc(seed) || 1
  return () => {
    value |= 0
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class GreenTerrain {
  private readonly size: number
  private readonly resolution: number
  private readonly maximumHeight: number
  private roughness: number
  private readonly heightMap: Float32Array
  private seed: number
  private perlin: Perlin
  private highFeatures: TerrainFeature[] = []
  private lowFeatures: TerrainFeature[] = []
  private waterHazards: WaterHazard[] = []
  private treeInstances: TerrainTreeInstance[] = []
  private courseStart = COURSE_START.clone()
  private courseHole = DEFAULT_COURSE_HOLE.clone()

  constructor(config: Partial<GreenTerrainConfig> = {}) {
    const values = { ...DEFAULT_TERRAIN, ...config }
    if (values.size <= 0 || values.resolution < 2 || values.maximumHeight < 0) {
      throw new Error('Terrain size and resolution must be positive; height cannot be negative')
    }

    this.size = values.size
    this.resolution = Math.floor(values.resolution)
    this.maximumHeight = values.maximumHeight
    this.roughness = THREE.MathUtils.clamp(values.roughness, 0, 1)
    this.seed = Math.trunc(values.seed)
    this.heightMap = new Float32Array(this.resolution * this.resolution)
    this.perlin = new Perlin(this.seed)
    this.rebuildProceduralFeatures()
    this.generateTerrain()
    this.generateTreeInstances()
  }

  /** Generates broad organic hills, basins and deterministic water hazards. */
  private generateTerrain(): void {
    const cellSize = this.getCellSize()

    for (let zIndex = 0; zIndex < this.resolution; zIndex++) {
      for (let xIndex = 0; xIndex < this.resolution; xIndex++) {
        const worldX = (xIndex - this.resolution / 2) * cellSize
        const worldZ = (zIndex - this.resolution / 2) * cellSize
        let height = this.sampleNoiseHeight(worldX, worldZ)

        for (const feature of this.lowFeatures) {
          height += this.sampleFeature(worldX, worldZ, feature)
        }

        for (const feature of this.highFeatures) {
          height += this.sampleFeature(worldX, worldZ, feature)
        }

        for (const hazard of this.waterHazards) {
          const lakeStrength = this.getWaterShapeStrength(worldX, worldZ, hazard)
          if (lakeStrength > 0) {
            const shoreBlend = THREE.MathUtils.smoothstep(lakeStrength, 0.05, 0.55)
            const lakeBed = hazard.waterLevel - 0.32 - lakeStrength * 0.72
            height = THREE.MathUtils.lerp(height, Math.min(height, lakeBed), shoreBlend)
          }
        }

        height = this.keepStartAndHolePlayable(worldX, worldZ, height)

        this.heightMap[xIndex + zIndex * this.resolution] = THREE.MathUtils.clamp(
          height,
          -this.maximumHeight * 0.78,
          this.maximumHeight * 1.25
        )
      }
    }
  }

  private sampleNoiseHeight(worldX: number, worldZ: number): number {
    const broad = this.perlin.noise(worldX * 0.01, worldZ * 0.01) * this.maximumHeight * 0.42
    const rolling =
      this.perlin.noise(worldX * 0.024 + 21.7, worldZ * 0.024 - 14.3) * this.maximumHeight * 0.24
    const detail =
      this.perlin.noise(worldX * 0.055 - 6.1, worldZ * 0.055 + 33.9) * this.maximumHeight * 0.07

    return broad + rolling + detail
  }

  private sampleFeature(worldX: number, worldZ: number, feature: TerrainFeature): number {
    const local = this.toFeatureLocal(worldX, worldZ, feature)
    const distance = Math.sqrt(
      (local.x * local.x) / (feature.radiusX * feature.radiusX) +
        (local.z * local.z) / (feature.radiusZ * feature.radiusZ)
    )

    if (distance >= 1) {
      return 0
    }

    const smoothFalloff = 1 - distance * distance * (3 - 2 * distance)
    return feature.strength * smoothFalloff
  }

  private rebuildProceduralFeatures(): void {
    const rng = createSeededRandom(this.seed)
    const half = this.size / 2
    const playableRange = half * 0.74
    this.highFeatures = []
    this.lowFeatures = []
    this.waterHazards = []
    this.treeInstances = []
    this.rebuildCourseAnchors(rng)

    const waterCount = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < waterCount; i++) {
      const waterCenter = this.pickCoursePoint(rng, playableRange, [
        { x: this.courseStart.x, z: this.courseStart.y, radius: 42 },
        { x: this.courseHole.x, z: this.courseHole.y, radius: 42 },
        ...this.waterHazards.map((hazard) => ({
          x: hazard.centerX,
          z: hazard.centerZ,
          radius: hazard.boundsRadius + 20,
        })),
      ])
      const waterHazard = this.createWaterHazard(rng, waterCenter.x, waterCenter.z)
      this.waterHazards.push(waterHazard)

      this.lowFeatures.push({
        centerX: waterHazard.centerX,
        centerZ: waterHazard.centerZ,
        radiusX: waterHazard.boundsRadius * this.randomRange(rng, 1.6, 2.25),
        radiusZ: waterHazard.boundsRadius * this.randomRange(rng, 1.45, 2.15),
        rotation: waterHazard.rotation + this.randomRange(rng, -0.45, 0.45),
        strength: -this.maximumHeight * this.randomRange(rng, 0.34, 0.55),
      })
    }

    const highCount = rng() < 0.55 ? 1 : 2
    for (let i = 0; i < highCount; i++) {
      const point = this.pickCoursePoint(rng, playableRange, [
        { x: this.courseStart.x, z: this.courseStart.y, radius: 32 },
        { x: this.courseHole.x, z: this.courseHole.y, radius: 36 },
        ...this.waterHazards.map((hazard) => ({
          x: hazard.centerX,
          z: hazard.centerZ,
          radius: hazard.boundsRadius + 24,
        })),
      ])
      this.highFeatures.push({
        centerX: point.x,
        centerZ: point.z,
        radiusX: this.randomRange(rng, 28, 52),
        radiusZ: this.randomRange(rng, 22, 48),
        rotation: this.randomRange(rng, 0, Math.PI),
        strength: this.maximumHeight * this.randomRange(rng, 0.7, 1.05),
      })
    }

    const lowCount = 2 + Math.floor(rng() * 2)
    for (let i = 0; i < lowCount; i++) {
      const point = this.pickCoursePoint(rng, playableRange, [
        { x: this.courseStart.x, z: this.courseStart.y, radius: 26 },
        { x: this.courseHole.x, z: this.courseHole.y, radius: 30 },
        ...this.waterHazards.map((hazard) => ({
          x: hazard.centerX,
          z: hazard.centerZ,
          radius: hazard.boundsRadius + 14,
        })),
      ])
      this.lowFeatures.push({
        centerX: point.x,
        centerZ: point.z,
        radiusX: this.randomRange(rng, 24, 48),
        radiusZ: this.randomRange(rng, 20, 44),
        rotation: this.randomRange(rng, 0, Math.PI),
        strength: -this.maximumHeight * this.randomRange(rng, 0.28, 0.48),
      })
    }
  }

  private rebuildCourseAnchors(rng: () => number): void {
    const distance = this.randomRange(rng, 58, 82)
    const directionOffset = this.randomRange(rng, -0.62, 0.62)
    const x = Math.sin(directionOffset) * distance
    const z = -Math.cos(directionOffset) * distance
    const limit = this.size / 2 - 36

    const startX = this.randomRange(rng, -16, 16)
    const startZ = this.randomRange(rng, -12, 14)
    this.courseStart = new THREE.Vector2(startX, startZ)
    this.courseHole = new THREE.Vector2(
      THREE.MathUtils.clamp(startX + x, -limit, limit),
      THREE.MathUtils.clamp(startZ + z, -limit, -30)
    )
  }

  private createWaterHazard(rng: () => number, centerX: number, centerZ: number): WaterHazard {
    const pointCount = 18 + Math.floor(rng() * 9)
    const radiusX = this.randomRange(rng, 9, 20)
    const radiusZ = this.randomRange(rng, 7, 17)
    const rotation = this.randomRange(rng, 0, Math.PI)
    const outline: WaterHazardPoint[] = []
    let boundsRadius = 0

    for (let i = 0; i < pointCount; i++) {
      const baseAngle = (i / pointCount) * Math.PI * 2
      const angle = baseAngle + this.randomRange(rng, -0.08, 0.08)
      const wobble =
        0.86 +
        rng() * 0.32 +
        Math.sin(baseAngle * 2 + rng() * 1.5) * 0.08 +
        Math.sin(baseAngle * 5 + rng() * 2.5) * 0.05
      const x = Math.cos(angle) * radiusX * wobble
      const z = Math.sin(angle) * radiusZ * wobble
      outline.push({ x, z })
      boundsRadius = Math.max(boundsRadius, Math.hypot(x, z))
    }

    return {
      centerX,
      centerZ,
      waterLevel: this.randomRange(rng, -0.18, 0.12),
      rotation,
      outline,
      boundsRadius,
    }
  }

  private generateTreeInstances(): void {
    const rng = createSeededRandom(this.seed + 1009)
    const half = this.size / 2
    const clusterCount = 8 + Math.floor(rng() * 4)
    const instances: TerrainTreeInstance[] = []

    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex++) {
      const center = this.pickCoursePoint(rng, half * 0.84, [
        { x: this.courseStart.x, z: this.courseStart.y, radius: 28 },
        { x: this.courseHole.x, z: this.courseHole.y, radius: 34 },
        ...this.waterHazards.map((hazard) => ({
          x: hazard.centerX,
          z: hazard.centerZ,
          radius: hazard.boundsRadius + 16,
        })),
      ])
      const patchCount = 2 + Math.floor(rng() * 3)
      const clusterRadius = this.randomRange(rng, 18, 38)
      const stretchX = this.randomRange(rng, 0.65, 1.35)
      const stretchZ = this.randomRange(rng, 0.65, 1.35)
      const clusterRotation = this.randomRange(rng, 0, Math.PI)
      const treeCount = 26 + Math.floor(rng() * 28)
      const patches: Array<{ x: number; z: number; radius: number }> = []

      for (let i = 0; i < patchCount; i++) {
        const angle = rng() * Math.PI * 2
        const distance = Math.sqrt(rng()) * clusterRadius * 0.48
        patches.push({
          x: center.x + Math.cos(angle) * distance,
          z: center.z + Math.sin(angle) * distance,
          radius: this.randomRange(rng, clusterRadius * 0.34, clusterRadius * 0.72),
        })
      }

      for (let i = 0; i < treeCount; i++) {
        const patch = patches[Math.floor(rng() * patches.length)] ?? patches[0]
        if (!patch) {
          continue
        }

        const angle = rng() * Math.PI * 2
        const radius = Math.pow(rng(), 0.72) * patch.radius
        const localX = Math.cos(angle) * radius * stretchX
        const localZ = Math.sin(angle) * radius * stretchZ
        const rotated = this.rotatePoint(localX, localZ, clusterRotation)
        const outlierChance = rng() < 0.12 ? this.randomRange(rng, 5, 14) : 0
        const outlierAngle = rng() * Math.PI * 2
        const x = patch.x + rotated.x + Math.cos(outlierAngle) * outlierChance
        const z = patch.z + rotated.z + Math.sin(outlierAngle) * outlierChance

        if (!this.isInsidePlayableSquare(x, z, 4)) {
          continue
        }
        if (this.isWaterAt(x, z)) {
          continue
        }
        if (Math.hypot(x - this.courseStart.x, z - this.courseStart.y) < 15) {
          continue
        }
        if (Math.hypot(x - this.courseHole.x, z - this.courseHole.y) < 22) {
          continue
        }

        const scale = this.randomRange(rng, 1.35, 3.15)
        instances.push({
          x,
          z,
          scale,
          rotationY: rng() * Math.PI * 2,
          typeIndex: Math.floor(rng() * 3),
          colliderRadius: THREE.MathUtils.clamp(0.22 * scale, 0.24, 0.72),
          colliderHeight: THREE.MathUtils.clamp(6.5 * scale, 6, 22),
        })
      }
    }

    this.treeInstances = instances
  }

  private pickCoursePoint(
    rng: () => number,
    range: number,
    exclusions: Array<{ x: number; z: number; radius: number }>
  ): { x: number; z: number } {
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = this.randomRange(rng, -range, range)
      const z = this.randomRange(rng, -range, range)
      const isExcluded = exclusions.some(
        (exclusion) => Math.hypot(x - exclusion.x, z - exclusion.z) < exclusion.radius
      )
      if (!isExcluded) {
        return { x, z }
      }
    }

    return { x: range * 0.45, z: -range * 0.45 }
  }

  private randomRange(rng: () => number, min: number, max: number): number {
    return THREE.MathUtils.lerp(min, max, rng())
  }

  /** Smoothly interpolates the four nearest height samples. */
  getHeightAt(x: number, z: number): number {
    const cellSize = this.getCellSize()
    const gridX = (x + this.size / 2) / cellSize
    const gridZ = (z + this.size / 2) / cellSize

    if (gridX < 0 || gridX > this.resolution - 1 || gridZ < 0 || gridZ > this.resolution - 1) {
      // Beyond the generated green the course continues as level ground.
      return 0
    }

    const x0 = Math.min(Math.floor(gridX), this.resolution - 2)
    const z0 = Math.min(Math.floor(gridZ), this.resolution - 2)
    const xFraction = gridX - x0
    const zFraction = gridZ - z0
    const h00 = this.heightMap[x0 + z0 * this.resolution]
    const h10 = this.heightMap[x0 + 1 + z0 * this.resolution]
    const h01 = this.heightMap[x0 + (z0 + 1) * this.resolution]
    const h11 = this.heightMap[x0 + 1 + (z0 + 1) * this.resolution]
    const nearHeight = THREE.MathUtils.lerp(h00, h10, xFraction)
    const farHeight = THREE.MathUtils.lerp(h01, h11, xFraction)

    return THREE.MathUtils.lerp(nearHeight, farHeight, zFraction) * this.roughness
  }

  /** Returns an upward unit normal calculated from the local height gradient. */
  getSurfaceNormalAt(x: number, z: number): THREE.Vector3 {
    if (!this.isOnGeneratedTerrain(x, z)) {
      return new THREE.Vector3(0, 1, 0)
    }

    const sampleDistance = this.getCellSize() * 0.5
    const minimum = -this.size / 2
    const maximum = minimum + (this.resolution - 1) * this.getCellSize()
    const leftX = Math.max(minimum, x - sampleDistance)
    const rightX = Math.min(maximum, x + sampleDistance)
    const backZ = Math.max(minimum, z - sampleDistance)
    const frontZ = Math.min(maximum, z + sampleDistance)
    const heightChangeX = this.getHeightAt(rightX, z) - this.getHeightAt(leftX, z)
    const heightChangeZ = this.getHeightAt(x, frontZ) - this.getHeightAt(x, backZ)
    const distanceX = Math.max(rightX - leftX, Number.EPSILON)
    const distanceZ = Math.max(frontZ - backZ, Number.EPSILON)

    return new THREE.Vector3(-heightChangeX / distanceX, 1, -heightChangeZ / distanceZ).normalize()
  }

  /** Compatibility helper: acceleration caused by gravity along the surface. */
  getSlopeGravity(position: THREE.Vector3): THREE.Vector3 {
    const normal = this.getSurfaceNormalAt(position.x, position.z)
    const gravity = new THREE.Vector3(0, -9.81, 0)
    return gravity.addScaledVector(normal, -gravity.dot(normal))
  }

  getHeightMap(): Float32Array {
    return this.heightMap
  }

  getHeightSample(index: number): number {
    return (this.heightMap[index] ?? 0) * this.roughness
  }

  getResolution(): number {
    return this.resolution
  }

  getSize(): number {
    return this.size
  }

  getConfig(): Readonly<GreenTerrainConfig> {
    return {
      size: this.size,
      resolution: this.resolution,
      maximumHeight: this.maximumHeight,
      roughness: this.roughness,
      seed: this.seed,
    }
  }

  getWaterHazards(): ReadonlyArray<WaterHazard> {
    return this.waterHazards
  }

  getTreeInstances(): ReadonlyArray<TerrainTreeInstance> {
    return this.treeInstances
  }

  getStartPosition(): THREE.Vector2 {
    return this.courseStart.clone()
  }

  getHolePosition(): THREE.Vector2 {
    return this.courseHole.clone()
  }

  getFlagCollider(): FlagCollider {
    return {
      x: this.courseHole.x + FLAG_OFFSET.x,
      z: this.courseHole.y + FLAG_OFFSET.y,
      radius: FLAG_COLLIDER_RADIUS,
      height: FLAG_COLLIDER_HEIGHT,
    }
  }

  getWaterLevel(hazard: WaterHazard): number {
    return hazard.waterLevel * this.roughness + 0.012
  }

  isWaterAt(x: number, z: number): boolean {
    return this.waterHazards.some((hazard) => this.isInsideWaterShape(x, z, hazard))
  }


  isWaterBetween(start: THREE.Vector3, end: THREE.Vector3, samples = 14): boolean {
    const count = Math.max(2, Math.floor(samples))
    for (let i = 1; i <= count; i++) {
      const t = i / count
      const x = THREE.MathUtils.lerp(start.x, end.x, t)
      const z = THREE.MathUtils.lerp(start.z, end.z, t)
      if (this.isWaterAt(x, z)) {
        return true
      }
    }
    return false
  }

  getNearestLandPosition(x: number, z: number, ballRadius: number): THREE.Vector3 {
    let dropX = x
    let dropZ = z
    const containingHazard = this.waterHazards.find((hazard) =>
      this.isInsideWaterShape(x, z, hazard)
    )

    if (containingHazard) {
      const local = this.toHazardLocal(x, z, containingHazard)
      const angle = Math.atan2(local.z, local.x)
      const edgeDistance = this.getWaterRadiusAtAngle(containingHazard, angle)
      const margin = Math.max(2.8, ballRadius * 7)
      const localDrop = new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(
        edgeDistance + margin
      )
      const worldDrop = this.fromHazardLocal(localDrop.x, localDrop.y, containingHazard)
      dropX = worldDrop.x
      dropZ = worldDrop.z
    }

    const limit = this.size / 2 - this.getCellSize() - ballRadius
    dropX = THREE.MathUtils.clamp(dropX, -limit, limit)
    dropZ = THREE.MathUtils.clamp(dropZ, -limit, limit)

    for (let attempts = 0; attempts < 20 && this.isWaterAt(dropX, dropZ); attempts++) {
      const angle = (attempts / 20) * Math.PI * 2
      const distance = 3 + attempts * 1.8
      dropX = THREE.MathUtils.clamp(dropX + Math.cos(angle) * distance, -limit, limit)
      dropZ = THREE.MathUtils.clamp(dropZ + Math.sin(angle) * distance, -limit, limit)
    }

    return new THREE.Vector3(dropX, this.getHeightAt(dropX, dropZ) + ballRadius, dropZ)
  }

  setRoughness(roughness: number): void {
    this.roughness = THREE.MathUtils.clamp(roughness, 0, 1)
  }

  setSeed(seed: number): void {
    this.regenerate(seed)
  }

  /** Rebuilds the course. Passing a seed makes the result reproducible. */
  regenerate(seed: number = this.seed + 1): void {
    this.seed = Math.trunc(seed)
    this.perlin = new Perlin(this.seed)
    this.rebuildProceduralFeatures()
    this.generateTerrain()
    this.generateTreeInstances()
  }

  public getCellSize(): number {
    // This matches the existing terrain renderer's vertex spacing.
    return this.size / this.resolution
  }

  private keepStartAndHolePlayable(worldX: number, worldZ: number, height: number): number {
    let adjustedHeight = height
    adjustedHeight = this.blendPlayablePatch(
      worldX,
      worldZ,
      adjustedHeight,
      this.courseStart.x,
      this.courseStart.y,
      START_PATCH_HEIGHT
    )
    adjustedHeight = this.blendPlayablePatch(
      worldX,
      worldZ,
      adjustedHeight,
      this.courseHole.x,
      this.courseHole.y,
      HOLE_PATCH_HEIGHT
    )
    return adjustedHeight
  }

  private blendPlayablePatch(
    worldX: number,
    worldZ: number,
    height: number,
    centerX: number,
    centerZ: number,
    targetHeight: number
  ): number {
    const distance = Math.hypot(worldX - centerX, worldZ - centerZ)
    const innerRadius = 8
    const outerRadius = 22

    if (distance >= outerRadius) {
      return height
    }

    const fadeOut = THREE.MathUtils.smoothstep(distance, innerRadius, outerRadius)
    return THREE.MathUtils.lerp(targetHeight, height, fadeOut)
  }

  private isOnGeneratedTerrain(x: number, z: number): boolean {
    const minimum = -this.size / 2
    const maximum = minimum + (this.resolution - 1) * this.getCellSize()
    return x >= minimum && x <= maximum && z >= minimum && z <= maximum
  }

  private isInsidePlayableSquare(x: number, z: number, margin: number): boolean {
    const limit = this.size / 2 - margin
    return x >= -limit && x <= limit && z >= -limit && z <= limit
  }

  private getWaterShapeStrength(x: number, z: number, hazard: WaterHazard): number {
    const distance = this.getWaterShapeDistance(x, z, hazard)
    if (distance >= 1) {
      return 0
    }

    const softenedDistance = THREE.MathUtils.smoothstep(distance, 0.78, 1)
    return 1 - softenedDistance
  }

  private getWaterShapeDistance(x: number, z: number, hazard: WaterHazard): number {
    const local = this.toHazardLocal(x, z, hazard)
    const distance = Math.hypot(local.x, local.z)
    if (distance === 0) {
      return 0
    }

    const radiusAtAngle = this.getWaterRadiusAtAngle(hazard, Math.atan2(local.z, local.x))
    return distance / Math.max(radiusAtAngle, Number.EPSILON)
  }

  private isInsideWaterShape(x: number, z: number, hazard: WaterHazard): boolean {
    const local = this.toHazardLocal(x, z, hazard)
    return this.isPointInsidePolygon(local.x, local.z, hazard.outline)
  }

  private getWaterRadiusAtAngle(hazard: WaterHazard, angle: number): number {
    const rayX = Math.cos(angle)
    const rayZ = Math.sin(angle)
    let nearest = Number.POSITIVE_INFINITY

    for (let i = 0; i < hazard.outline.length; i++) {
      const a = hazard.outline[i]
      const b = hazard.outline[(i + 1) % hazard.outline.length]
      if (!a || !b) {
        continue
      }

      const segmentX = b.x - a.x
      const segmentZ = b.z - a.z
      const determinant = rayZ * segmentX - rayX * segmentZ
      if (Math.abs(determinant) < 1e-6) {
        continue
      }

      const distanceAlongRay = (a.z * segmentX - a.x * segmentZ) / determinant
      const segmentFactor = (rayX * a.z - rayZ * a.x) / determinant
      if (distanceAlongRay >= 0 && segmentFactor >= 0 && segmentFactor <= 1) {
        nearest = Math.min(nearest, distanceAlongRay)
      }
    }

    return Number.isFinite(nearest) ? nearest : hazard.boundsRadius
  }

  private isPointInsidePolygon(
    x: number,
    z: number,
    polygon: ReadonlyArray<WaterHazardPoint>
  ): boolean {
    let inside = false

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const current = polygon[i]
      const previous = polygon[j]
      if (!current || !previous) {
        continue
      }

      const intersects =
        current.z > z !== previous.z > z &&
        x < ((previous.x - current.x) * (z - current.z)) / (previous.z - current.z) + current.x
      if (intersects) {
        inside = !inside
      }
    }

    return inside
  }

  private toHazardLocal(x: number, z: number, hazard: WaterHazard): { x: number; z: number } {
    const dx = x - hazard.centerX
    const dz = z - hazard.centerZ
    const cos = Math.cos(-hazard.rotation)
    const sin = Math.sin(-hazard.rotation)
    return {
      x: dx * cos - dz * sin,
      z: dx * sin + dz * cos,
    }
  }

  private fromHazardLocal(x: number, z: number, hazard: WaterHazard): { x: number; z: number } {
    const cos = Math.cos(hazard.rotation)
    const sin = Math.sin(hazard.rotation)
    return {
      x: hazard.centerX + x * cos - z * sin,
      z: hazard.centerZ + x * sin + z * cos,
    }
  }

  private toFeatureLocal(x: number, z: number, feature: TerrainFeature): { x: number; z: number } {
    const dx = x - feature.centerX
    const dz = z - feature.centerZ
    const cos = Math.cos(-feature.rotation)
    const sin = Math.sin(-feature.rotation)
    return {
      x: dx * cos - dz * sin,
      z: dx * sin + dz * cos,
    }
  }

  private rotatePoint(x: number, z: number, angle: number): { x: number; z: number } {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return {
      x: x * cos - z * sin,
      z: x * sin + z * cos,
    }
  }
}
