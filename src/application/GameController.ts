/**
 * ============================================================================
 * LAYER 2: GAME CONTROLLER (Main Orchestrator)
 * ============================================================================
 *
 * This is the "conductor" of the entire application.
 *
 * The Game Controller:
 * 1. Creates all subsystems (physics, rendering, UI, etc.)
 * 2. Coordinates them each frame
 * 3. Handles the game loop and frame synchronization
 * 4. Mediates communication between layers
 *
 * It does NOT:
 * - Calculate physics itself (delegates to Layer 3: PhysicsEngine)
 * - Render anything itself (delegates to Layer 4: Renderer)
 * - Handle input itself (receives from Layer 1: UIController)
 *
 * Think of it as a movie director:
 * - Doesn't act (Layer 1), direct cinematography (Layer 4), or choreograph fights (Layer 3)
 * - But coordinates all three to work together
 *
 * Data flow each frame:
 * 1. Update physics (Layer 3)
 * 2. Update UI with new state (Layer 1)
 * 3. Render the frame (Layer 4)
 */

import * as THREE from 'three'

// Layer 4: Rendering
import { Renderer } from '../rendering/Renderer'
import { SceneManager } from '../rendering/SceneManager'
import { CameraSystem } from '../rendering/cameras/CameraSystem'
import { GreenRenderer } from '../rendering/meshes/GreenRenderer'
import { CourseBoundaryRenderer } from '../rendering/meshes/CourseBoundaryRenderer'
import { WaterHazardRenderer } from '../rendering/meshes/WaterHazardRenderer'
import { TrajectoryPreviewRenderer } from '../rendering/meshes/TrajectoryPreviewRenderer'
import { GolfSceneModels } from '../rendering/models/GolfSceneModels'

// Layer 3: Physics
import { GreenTerrain } from '../domain/physics/GreenTerrain'
import { BallPhysics } from '../domain/physics/BallPhysics'
import { PhysicsEngine } from '../domain/physics/PhysicsEngine'
import { ClubImpact } from '../domain/physics/ClubImpact'

// Layer 2: Hit orchestration
import { HitController } from './hit/HitController'
import { DEFAULT_SHOT_SETTINGS } from './hit/ShotSettings'

// Layer 1: UI & Input
import { FirstPersonCamera } from '../presentation/camera/FirstPersonCamera'
import { OrbitCamera } from '../presentation/camera/OrbitCamera'
import { InputHandler } from '../presentation/input/InputHandler'
import { SimulationPanels } from '../presentation/ui/SimulationPanels'
import type { SimulationControlValues } from '../presentation/ui/SimulationPanels'

// Shared
import { Loop } from '../shared/core/Loop'
import { Sizes } from '../shared/utils/Sizes'

// Keep the panel value realistic while the actual gameplay gravity is slightly stronger.
const GAMEPLAY_GRAVITY_MULTIPLIER = 1.08

/**
 * Current game state.
 * Used to coordinate between layers.
 */
interface GameState {
  ballPosition: THREE.Vector3
  ballVelocity: THREE.Vector3
  isBallMoving: boolean
  score: number
  currentHole: number
}

export class GameController {
  /**
   * Canvas element where rendering happens.
   */
  private canvas: HTMLCanvasElement

  /**
   * Tracks window size and provides resize events.
   */
  private sizes: Sizes

  /**
   * Main animation loop.
   */
  private loop: Loop

  /**
   * ========== LAYER 4: RENDERING ==========
   */
  private renderer: Renderer
  private sceneManager: SceneManager
  private cameraSystem: CameraSystem
  private greenRenderer: GreenRenderer
  private waterHazardRenderer: WaterHazardRenderer
  private trajectoryPreviewRenderer: TrajectoryPreviewRenderer
  private courseBoundaryRenderer: CourseBoundaryRenderer
  private golfModels: GolfSceneModels

  /**
   * ========== LAYER 3: PHYSICS ==========
   */
  private greenTerrain: GreenTerrain
  private ballPhysics: BallPhysics
  private physicsEngine: PhysicsEngine

  /**
   * ========== LAYER 1: UI & INPUT ==========
   */
  private inputHandler: InputHandler
  private cameraController: FirstPersonCamera
  private orbitCamera: OrbitCamera
  private activeCameraMode: 'free' | 'orbit' = 'free'
  private simulationPanels: SimulationPanels

  /**
   * ========== LAYER 2: STATE ==========
   */
  private gameState: GameState
  private hitController: HitController
  private controlValues: SimulationControlValues
  private simulationTime = 0
  private isSimulationComplete = false
  private previousVelocity = new THREE.Vector3()
  private currentAcceleration = new THREE.Vector3()
  private readonly currentShotDirection = new THREE.Vector3(0, 0, -1)
  private trajectoryPreviewSignature = ''
  private smoothedFps = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    this.gameState = this.createInitialGameState()

    // Initialize sizes (used by multiple systems)
    this.sizes = new Sizes()

    // ========== INITIALIZE LAYER 3: PHYSICS ==========
    console.log('🏌️ Initializing physics...')
    this.greenTerrain = new GreenTerrain()
    const startPoint = this.greenTerrain.getStartPosition()
    this.ballPhysics = new BallPhysics(
      'ball',
      new THREE.Vector3(startPoint.x, 0.2, startPoint.y),
      this.greenTerrain
    )
    this.physicsEngine = new PhysicsEngine(this.greenTerrain)
    this.physicsEngine.addObject(this.ballPhysics)

    // ========== INITIALIZE LAYER 1: INPUT & CAMERA ==========
    console.log('🎮 Initializing input...')
    this.inputHandler = new InputHandler(this.canvas)
    this.inputHandler.setPointerLockEnabled(true)
    this.cameraController = new FirstPersonCamera(this.inputHandler)
    this.cameraController.setTerrainConstraint(this.greenTerrain)
    this.orbitCamera = new OrbitCamera(this.inputHandler, this.ballPhysics.getPosition())
    this.orbitCamera.setTerrainConstraint(this.greenTerrain)

    // ========== INITIALIZE LAYER 4: RENDERING ==========
    console.log('🎨 Initializing rendering...')
    this.renderer = new Renderer(canvas, this.sizes)
    this.sceneManager = new SceneManager()

    // Create terrain mesh from physics data
    this.greenRenderer = new GreenRenderer(this.greenTerrain)
    this.sceneManager.add(this.greenRenderer.getMesh())

    this.waterHazardRenderer = new WaterHazardRenderer(this.greenTerrain)
    this.sceneManager.add(this.waterHazardRenderer.getObject3D())

    this.trajectoryPreviewRenderer = new TrajectoryPreviewRenderer()
    this.sceneManager.add(this.trajectoryPreviewRenderer.getObject3D())

    this.courseBoundaryRenderer = new CourseBoundaryRenderer(this.greenTerrain)
    this.sceneManager.add(this.courseBoundaryRenderer.getObject3D())
    this.ballPhysics.setBoundaryHalfSize(this.courseBoundaryRenderer.getPhysicsHalfSize())

    // Models own their placeholders and can later accept loaded GLTF scenes.
    this.golfModels = new GolfSceneModels(this.greenTerrain, this.ballPhysics.getRadius())
    this.sceneManager.add(this.golfModels.getObject3D())

    this.controlValues = this.createInitialControlValues()

    // Application-layer bridge between input, physics and the club visual.
    this.hitController = new HitController(
      this.physicsEngine,
      this.ballPhysics,
      this.golfModels.club.getObject3D(),
      this.controlValues
    )

    this.simulationPanels = new SimulationPanels({
      controls: this.controlValues,
      onControlsChange: (controls) => this.applyControlValues(controls),
    })
    this.applyControlValues(this.controlValues)

    this.setupInputHandlers()

    // Setup camera
    this.cameraSystem = new CameraSystem(
      this.sizes.width / this.sizes.height,
      this.cameraController
    )

    // ========== INITIALIZE GAME LOOP ==========
    console.log('▶️ Starting game loop...')
    this.loop = new Loop()
    this.loop.onTick((deltaTime) => this.update(deltaTime))
    this.loop.start()

    // Handle window resize
    this.sizes.onResize(() => this.onResize())

    console.log('✅ Game initialized!')
    console.log('Hit controls: H = hit, R = reset, right panel = physics controls')
  }

  /**
   * Create initial game state.
   */
  private createInitialGameState(): GameState {
    return {
      ballPosition: new THREE.Vector3(0, 0.2, 0),
      ballVelocity: new THREE.Vector3(0, 0, 0),
      isBallMoving: false,
      score: 0,
      currentHole: 1,
    }
  }

  /**
   * Setup input event handlers.
   * Bridges Layer 1 (input) with Layer 2 (orchestration).
   */
  private setupInputHandlers(): void {
    this.inputHandler.onPointerLockChange((isLocked) => {
      document.body.classList.toggle('camera-locked', isLocked)
    })

    this.inputHandler.onKeyDown((key) => {
      if (key === 'h' || key === 'H') {
        this.performHit()
      }
      if (key === 'r' || key === 'R') {
        this.resetSimulation()
      }
      if (key === 'c' || key === 'C') {
        this.toggleCameraMode()
      }
    })
  }

  /**
   * Perform a swing.
   * Called by input handler.
   * Bridges Layer 1 (input) → Layer 2 (command) → Layer 3 (physics).
   */
  private performHit(): void {
    if (this.isSimulationComplete) {
      return
    }

    const aimDirection = this.getAimDirectionToHole()
    const result = this.hitController.hit(aimDirection)

    if (result?.didHit) {
      this.gameState.isBallMoving = true
      this.gameState.score += 1
      this.trajectoryPreviewRenderer.setVisible(false)
      this.invalidateTrajectoryPreview()
    }
  }

  private toggleCameraMode(): void {
    const currentPosition = this.getActiveCameraPosition()
    const currentTarget = this.getActiveCameraTarget()
    if (this.activeCameraMode === 'free') {
      this.activeCameraMode = 'orbit'
      this.inputHandler.setPointerLockEnabled(true)
      this.orbitCamera.setPose(currentPosition, this.ballPhysics.getPosition())
    } else {
      this.activeCameraMode = 'free'
      this.inputHandler.setPointerLockEnabled(true)
      this.cameraController.setPose(currentPosition, currentTarget)
    }
  }

  private updateActiveCamera(deltaTime: number): void {
    if (this.activeCameraMode === 'orbit') {
      this.orbitCamera.update(deltaTime, this.ballPhysics.getPosition())
      return
    }
    this.cameraController.update(deltaTime)
  }

  private getActiveCameraPosition(): THREE.Vector3 {
    return this.activeCameraMode === 'orbit'
      ? this.orbitCamera.getPosition()
      : this.cameraController.getPosition()
  }

  private getActiveCameraTarget(): THREE.Vector3 {
    return this.activeCameraMode === 'orbit'
      ? this.orbitCamera.getTarget()
      : this.cameraController.getTarget()
  }

  private createInitialControlValues(): SimulationControlValues {
    const ballConfig = this.ballPhysics.getConfig()
    const terrainConfig = this.greenTerrain.getConfig()

    return {
      ...DEFAULT_SHOT_SETTINGS,
      ballMass: ballConfig.mass,
      ballRadius: ballConfig.radius,
      gravity: ballConfig.gravity,
      airDensity: ballConfig.airDensity,
      dragCoefficient: ballConfig.dragCoefficient,
      magnusCoefficient: ballConfig.magnusCoefficient,
      maximumLiftCoefficient: ballConfig.maximumLiftCoefficient,
      bounce: ballConfig.restitution,
      impactFriction: ballConfig.impactFriction,
      slidingFriction: ballConfig.slidingFriction,
      rollingResistance: ballConfig.rollingResistance,
      slopeStrength: ballConfig.slopeStrength,
      stopSpeed: ballConfig.stopSpeed,
      bounceSpeed: ballConfig.bounceSpeed,
      terrainRoughness: terrainConfig.roughness,
      terrainSeed: terrainConfig.seed,
      windStrength: ballConfig.windVelocity.length(),
      windDirectionDegrees: 0,
      timeScale: 1,
      maximumDeltaTime: ballConfig.maximumDeltaTime,
      simulationStep: ballConfig.simulationStep,
    }
  }

  private applyControlValues(controls: SimulationControlValues): void {
    const previousRadius = this.controlValues.ballRadius
    const previousTerrainRoughness = this.controlValues.terrainRoughness
    const previousTerrainSeed = this.controlValues.terrainSeed
    this.controlValues = { ...controls }

    this.hitController.setSettings({
      hitPower: controls.hitPower,
      minClubHeadSpeed: controls.minClubHeadSpeed,
      maxClubHeadSpeed: controls.maxClubHeadSpeed,
      launchAngleDegrees: controls.launchAngleDegrees,
      directionDegrees: controls.directionDegrees,
      spinPercent: controls.spinPercent,
      sideSpinPercent: controls.sideSpinPercent,
      effectiveClubMass: controls.effectiveClubMass,
      restitution: controls.restitution,
      friction: controls.friction,
      showTrajectoryPreview: controls.showTrajectoryPreview,
    })

    this.ballPhysics.updateConfig({
      mass: controls.ballMass,
      radius: controls.ballRadius,
      gravity: this.getGameplayGravity(controls.gravity),
      airDensity: controls.airDensity,
      dragCoefficient: controls.dragCoefficient,
      magnusCoefficient: controls.magnusCoefficient,
      maximumLiftCoefficient: controls.maximumLiftCoefficient,
      restitution: controls.bounce,
      impactFriction: controls.impactFriction,
      slidingFriction: controls.slidingFriction,
      rollingResistance: controls.rollingResistance,
      slopeStrength: controls.slopeStrength,
      stopSpeed: controls.stopSpeed,
      bounceSpeed: controls.bounceSpeed,
      maximumDeltaTime: controls.maximumDeltaTime,
      simulationStep: controls.simulationStep,
      windVelocity: this.createWindVelocity(controls.windStrength, controls.windDirectionDegrees),
    })

    if (controls.terrainSeed !== previousTerrainSeed) {
      this.regenerateCourse(controls.terrainSeed, controls.terrainRoughness)
    } else if (controls.terrainRoughness !== previousTerrainRoughness) {
      this.greenTerrain.setRoughness(controls.terrainRoughness)
      this.refreshCourseFromTerrain()
      this.ballPhysics.alignToTerrain()
    }

    if (controls.ballRadius !== previousRadius) {
      this.golfModels.setBallPhysicalRadius(controls.ballRadius)
      this.ballPhysics.alignToTerrain()
    }

    this.invalidateTrajectoryPreview()
  }

  private regenerateCourse(seed: number, terrainRoughness: number): void {
    this.greenTerrain.setRoughness(terrainRoughness)
    this.greenTerrain.regenerate(seed)
    this.refreshCourseFromTerrain()
    this.resetSimulation()
    this.simulationPanels.showStatusMessage(`Course regenerated with seed ${Math.trunc(seed)}.`)
  }

  private refreshCourseFromTerrain(): void {
    this.greenRenderer.updateFromTerrain()
    this.waterHazardRenderer.updateFromTerrain()
    this.courseBoundaryRenderer.updateFromTerrain()
    this.ballPhysics.setBoundaryHalfSize(this.courseBoundaryRenderer.getPhysicsHalfSize())
    this.golfModels.refreshForTerrain()
    this.invalidateTrajectoryPreview()
  }

  private getGameplayGravity(displayGravity: number): number {
    return displayGravity * GAMEPLAY_GRAVITY_MULTIPLIER
  }

  private createWindVelocity(strength: number, directionDegrees: number): THREE.Vector3 {
    const direction = THREE.MathUtils.degToRad(directionDegrees)
    return new THREE.Vector3(Math.sin(direction) * strength, 0, Math.cos(direction) * strength)
  }

  private handleWaterHazard(): boolean {
    if (this.isSimulationComplete) {
      return false
    }

    const ballPosition = this.ballPhysics.getPosition()
    if (!this.greenTerrain.isWaterAt(ballPosition.x, ballPosition.z)) {
      return false
    }

    const dropPosition = this.greenTerrain.getNearestLandPosition(
      ballPosition.x,
      ballPosition.z,
      this.ballPhysics.getRadius()
    )

    this.gameState.score += 1
    this.ballPhysics.setPosition(dropPosition)
    this.ballPhysics.reset()
    this.hitController.reset()
    this.gameState.ballPosition.copy(dropPosition)
    this.gameState.ballVelocity.set(0, 0, 0)
    this.gameState.isBallMoving = false
    this.currentAcceleration.set(0, 0, 0)
    this.previousVelocity.set(0, 0, 0)
    this.golfModels.syncBall(this.ballPhysics.getPosition(), this.ballPhysics.getRotation())
    this.invalidateTrajectoryPreview()
    this.simulationPanels.showStatusMessage('Penalty stroke! Dropped at nearest land.')

    return true
  }

  private getDistanceToHole(): number {
    return this.golfModels.hole
      .getObject3D()
      .getWorldPosition(new THREE.Vector3())
      .distanceTo(this.ballPhysics.getPosition())
  }

  private getHeightAboveTerrain(): number {
    const ballPosition = this.ballPhysics.getPosition()
    const terrainHeight = this.greenTerrain.getHeightAt(ballPosition.x, ballPosition.z)
    return ballPosition.y - terrainHeight
  }

  private canHit(): boolean {
    return !this.isSimulationComplete && this.ballPhysics.canBeHit()
  }

  private checkHoleCompletion(): void {
    if (this.isSimulationComplete) {
      return
    }

    const ballPosition = this.ballPhysics.getPosition()
    const holePosition = this.golfModels.hole.getObject3D().getWorldPosition(new THREE.Vector3())
    const horizontalDistance = Math.hypot(
      ballPosition.x - holePosition.x,
      ballPosition.z - holePosition.z
    )
    const captureRadius = Math.max(0.65, this.ballPhysics.getRadius() * 11)
    const ballIsLowEnough = this.getHeightAboveTerrain() <= this.ballPhysics.getRadius() * 3

    if (horizontalDistance > captureRadius || !ballIsLowEnough) {
      return
    }

    const finalPosition = holePosition.clone()
    finalPosition.y =
      this.greenTerrain.getHeightAt(finalPosition.x, finalPosition.z) + this.ballPhysics.getRadius()

    this.ballPhysics.setPosition(finalPosition)
    this.ballPhysics.reset()
    this.gameState.ballPosition.copy(finalPosition)
    this.gameState.ballVelocity.set(0, 0, 0)
    this.gameState.isBallMoving = false
    this.isSimulationComplete = true
    this.currentAcceleration.set(0, 0, 0)
    this.previousVelocity.set(0, 0, 0)
    this.golfModels.syncBall(this.ballPhysics.getPosition(), this.ballPhysics.getRotation())
    this.trajectoryPreviewRenderer.setVisible(false)
    this.invalidateTrajectoryPreview()
    this.simulationPanels.showCompletionMessage(this.gameState.score)
  }

  /**
   * Reset ball position.
   */
  private resetSimulation(): void {
    const startPoint = this.greenTerrain.getStartPosition()
    this.ballPhysics.setPosition(new THREE.Vector3(startPoint.x, 0, startPoint.y))
    this.ballPhysics.reset()
    this.hitController.reset()
    this.gameState.isBallMoving = false
    this.gameState.score = 0
    this.isSimulationComplete = false
    this.simulationPanels.hideCompletionMessage()
    this.simulationTime = 0
    this.previousVelocity.set(0, 0, 0)
    this.currentAcceleration.set(0, 0, 0)
    this.invalidateTrajectoryPreview()
    const plane = this.golfModels.getPlane()
    if (plane) {
      plane.position.z = -100
    }
  }

  /**
   * Main update loop.
   * Called every frame by the game loop.
   * Coordinates all layers.
   *
   * Order matters:
   * 1. Update physics (calculate new positions)
   * 2. Update the independent spectator camera from user input
   * 3. Sync visuals (set mesh positions based on physics)
   * 4. Render (draw the frame)
   */
  private update(deltaTime: number): void {
    this.updateFps(deltaTime)
    // === LAYER 3: UPDATE PHYSICS ===
    const scaledDeltaTime = this.isSimulationComplete ? 0 : deltaTime * this.controlValues.timeScale
    this.simulationTime += scaledDeltaTime
    if (!this.isSimulationComplete) {
      this.physicsEngine.update(scaledDeltaTime)
      if (!this.handleWaterHazard()) {
        this.checkHoleCompletion()
      }
    }
    this.hitController.update(deltaTime)
    this.golfModels.update(deltaTime, this.controlValues.windStrength)
    const plane = this.golfModels.getPlane()

    if (plane) {
      plane.position.z -= 0.2
    }
    // === LAYER 2: UPDATE GAME STATE ===
    this.gameState.ballPosition.copy(this.ballPhysics.getPosition())
    this.gameState.ballVelocity.copy(this.ballPhysics.getVelocity())
    this.gameState.isBallMoving = this.ballPhysics.isActive()
    if (scaledDeltaTime > 0 && this.gameState.isBallMoving) {
      this.currentAcceleration
        .copy(this.gameState.ballVelocity)
        .sub(this.previousVelocity)
        .divideScalar(scaledDeltaTime)
      this.previousVelocity.copy(this.gameState.ballVelocity)
    } else {
      this.currentAcceleration.set(0, 0, 0)
      this.previousVelocity.copy(this.gameState.ballVelocity)
    }

    this.simulationPanels.update({
      position: this.gameState.ballPosition,
      velocity: this.gameState.ballVelocity,
      acceleration: this.currentAcceleration,
      angularVelocity: this.ballPhysics.getAngularVelocity(),
      motionState: this.ballPhysics.getMotionState(),
      isActive: this.gameState.isBallMoving,
      canHit: this.canHit(),
      score: this.gameState.score,
      currentHole: this.gameState.currentHole,
      distanceToHole: this.getDistanceToHole(),
      heightAboveTerrain: this.getHeightAboveTerrain(),
      simulationTime: this.simulationTime,
      clubHeadSpeed: this.hitController.getClubHeadSpeed(),
      fps: this.smoothedFps,
      controls: this.controlValues,
    })

    this.updateActiveCamera(deltaTime)

    // === LAYER 4: SYNC RENDERING ===
    this.golfModels.syncBall(this.gameState.ballPosition, this.ballPhysics.getRotation())
    this.updateShotPreviewAndGolfer()

    this.cameraSystem.update(this.getActiveCameraPosition(), this.getActiveCameraTarget())

    // === RENDER FRAME ===
    this.renderer.render(this.sceneManager.getScene(), this.cameraSystem.getCamera())
  }

  private updateFps(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return
    }

    const instantFps = 1 / deltaTime
    this.smoothedFps =
      this.smoothedFps === 0 ? instantFps : THREE.MathUtils.lerp(this.smoothedFps, instantFps, 0.08)
  }

  private getAimDirectionToHole(): THREE.Vector3 {
    return this.golfModels.hole
      .getObject3D()
      .getWorldPosition(new THREE.Vector3())
      .sub(this.ballPhysics.getPosition())
  }

  private updateShotPreviewAndGolfer(): void {
    const aimDirection = this.getAimDirectionToHole()
    const shotDirection = this.hitController.getShotDirection(aimDirection)
    if (shotDirection.lengthSq() > 0) {
      this.currentShotDirection.copy(shotDirection)
    }

    if (this.canHit()) {
      this.golfModels.syncGolfer(this.ballPhysics.getPosition(), this.currentShotDirection)
    }

    if (!this.controlValues.showTrajectoryPreview || !this.canHit()) {
      this.trajectoryPreviewRenderer.setVisible(false)
      return
    }

    const signature = this.createTrajectoryPreviewSignature()
    if (signature === this.trajectoryPreviewSignature) {
      this.trajectoryPreviewRenderer.setVisible(true)
      return
    }

    this.trajectoryPreviewSignature = signature
    this.trajectoryPreviewRenderer.setPoints(
      this.predictTrajectoryPoints(aimDirection, this.currentShotDirection)
    )
  }

  private createTrajectoryPreviewSignature(): string {
    const position = this.ballPhysics.getPosition()
    const controls = this.controlValues
    return [
      position.x.toFixed(2),
      position.y.toFixed(2),
      position.z.toFixed(2),
      controls.hitPower,
      controls.minClubHeadSpeed,
      controls.maxClubHeadSpeed,
      controls.launchAngleDegrees,
      controls.directionDegrees,
      controls.spinPercent,
      controls.sideSpinPercent,
      controls.effectiveClubMass,
      controls.restitution,
      controls.friction,
      controls.ballMass,
      controls.ballRadius,
      controls.gravity,
      controls.airDensity,
      controls.dragCoefficient,
      controls.magnusCoefficient,
      controls.maximumLiftCoefficient,
      controls.bounce,
      controls.impactFriction,
      controls.slidingFriction,
      controls.rollingResistance,
      controls.slopeStrength,
      controls.stopSpeed,
      controls.bounceSpeed,
      controls.windStrength,
      controls.windDirectionDegrees,
      controls.terrainSeed,
      controls.terrainRoughness,
    ].join('|')
  }

  private invalidateTrajectoryPreview(): void {
    this.trajectoryPreviewSignature = ''
  }

  private predictTrajectoryPoints(
    aimDirection: THREE.Vector3,
    shotDirection: THREE.Vector3
  ): THREE.Vector3[] {
    const startPosition = this.ballPhysics.getPosition()
    const ballConfig = this.ballPhysics.getConfig()
    const previewBall = new BallPhysics(
      'trajectory-preview-ball',
      startPosition,
      this.greenTerrain,
      {
        ...ballConfig,
        windVelocity: ballConfig.windVelocity.clone(),
      }
    )
    previewBall.setBoundaryHalfSize(this.courseBoundaryRenderer.getPhysicsHalfSize())

    const horizontalAim = this.hitController.getShotDirection(aimDirection)
    const result = previewBall.hitByClub({
      clubHeadVelocity: horizontalAim.clone().multiplyScalar(this.hitController.getClubHeadSpeed()),
      faceNormal: ClubImpact.createFaceNormal(horizontalAim, this.controlValues.launchAngleDegrees),
      effectiveClubMass: this.controlValues.effectiveClubMass,
      restitution: this.controlValues.restitution,
      friction: this.controlValues.friction,
    })

    if (!result.didHit) {
      return []
    }

    previewBall.applyShotSpin(
      horizontalAim,
      this.controlValues.spinPercent,
      this.controlValues.sideSpinPercent
    )

    const points: THREE.Vector3[] = [this.getPreviewPoint(previewBall.getPosition())]
    const predictionStep = 1 / 60
    const maxPredictionTime = 7
    const maxPoints = 260
    let elapsed = 0
    let previousPosition = previewBall.getPosition()
    let quietTime = 0

    while (elapsed < maxPredictionTime && points.length < maxPoints) {
      previewBall.update(predictionStep)
      elapsed += predictionStep
      const position = previewBall.getPosition()
      const speed = previewBall.getVelocity().length()
      const movedDistance = position.distanceTo(previousPosition)
      points.push(this.getPreviewPoint(position))

      if (
        this.greenTerrain.isWaterBetween(previousPosition, position) ||
        this.greenTerrain.isWaterAt(position.x, position.z)
      ) {
        const dropPosition = this.greenTerrain.getNearestLandPosition(
          position.x,
          position.z,
          previewBall.getRadius()
        )
        points.push(this.getPreviewPoint(dropPosition))
        break
      }

      if (this.isPredictedHoleCompletion(position, previewBall.getRadius())) {
        const holePosition = this.golfModels.hole
          .getObject3D()
          .getWorldPosition(new THREE.Vector3())
        holePosition.y =
          this.greenTerrain.getHeightAt(holePosition.x, holePosition.z) + previewBall.getRadius()
        points.push(this.getPreviewPoint(holePosition))
        break
      }

      if (!previewBall.isActive() || previewBall.canBeHit()) {
        break
      }

      if (speed < Math.max(this.controlValues.stopSpeed, 0.05) && movedDistance < 0.015) {
        quietTime += predictionStep
        if (quietTime > 0.45) {
          break
        }
      } else {
        quietTime = 0
      }

      previousPosition = position.clone()
    }

    if (points.length > 1 && shotDirection.lengthSq() > 0) {
      const first = points[0]
      const guide = first.clone().add(shotDirection.clone().normalize().multiplyScalar(0.45))
      guide.y = first.y
      points.splice(1, 0, guide)
    }

    return points
  }

  private isPredictedHoleCompletion(position: THREE.Vector3, ballRadius: number): boolean {
    const holePosition = this.golfModels.hole.getObject3D().getWorldPosition(new THREE.Vector3())
    const horizontalDistance = Math.hypot(position.x - holePosition.x, position.z - holePosition.z)
    const captureRadius = Math.max(0.65, ballRadius * 11)
    const heightAboveTerrain = position.y - this.greenTerrain.getHeightAt(position.x, position.z)

    return horizontalDistance <= captureRadius && heightAboveTerrain <= ballRadius * 3
  }

  private getPreviewPoint(position: THREE.Vector3): THREE.Vector3 {
    return position.clone().add(new THREE.Vector3(0, 0.08, 0))
  }

  /**
   * Handle window resize.
   */
  private onResize(): void {
    // Notify all systems that size changed
    this.cameraSystem.updateAspect(this.sizes.width / this.sizes.height)
    this.renderer.updateSize(this.sizes)
  }

  /**
   * Cleanup when closing the app.
   */
  dispose(): void {
    console.log('🧹 Cleaning up...')
    this.loop.dispose()
    this.cameraController.dispose()
    this.orbitCamera.dispose()
    this.inputHandler.dispose()
    this.simulationPanels.dispose()
    document.body.classList.remove('camera-locked')
    this.golfModels.dispose()
    this.trajectoryPreviewRenderer.dispose()
    this.courseBoundaryRenderer.dispose()
    this.waterHazardRenderer.dispose()
    this.greenRenderer.dispose()
    this.renderer.dispose()
    this.sizes.dispose()
  }
}
