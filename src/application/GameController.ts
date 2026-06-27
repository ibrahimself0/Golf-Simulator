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

import * as THREE from 'three';

// Layer 4: Rendering
import { Renderer } from '../rendering/Renderer';
import { SceneManager } from '../rendering/SceneManager';
import { CameraSystem } from '../rendering/cameras/CameraSystem';
import { GreenRenderer } from '../rendering/meshes/GreenRenderer';
import { GolfSceneModels } from '../rendering/models/GolfSceneModels';

// Layer 3: Physics
import { GreenTerrain } from '../domain/physics/GreenTerrain';
import { BallPhysics } from '../domain/physics/BallPhysics';
import { PhysicsEngine } from '../domain/physics/PhysicsEngine';

// Layer 2: Hit orchestration
import { HitController } from './hit/HitController';
import { HIT_STRENGTH_LEVELS } from './hit/HitStrengthLevels';

// Layer 1: UI & Input
import { FirstPersonCamera } from '../presentation/camera/FirstPersonCamera';
import { InputHandler } from '../presentation/input/InputHandler';

// Shared
import { Loop } from '../shared/core/Loop';
import { Sizes } from '../shared/utils/Sizes';

/**
 * Current game state.
 * Used to coordinate between layers.
 */
interface GameState {
  ballPosition: THREE.Vector3;
  ballVelocity: THREE.Vector3;
  isBallMoving: boolean;
  score: number;
  currentHole: number;
}

export class GameController {
  /**
   * Canvas element where rendering happens.
   */
  private canvas: HTMLCanvasElement;

  /**
   * Tracks window size and provides resize events.
   */
  private sizes: Sizes;

  /**
   * Main animation loop.
   */
  private loop: Loop;

  /**
   * ========== LAYER 4: RENDERING ==========
   */
  private renderer: Renderer;
  private sceneManager: SceneManager;
  private cameraSystem: CameraSystem;
  private greenRenderer: GreenRenderer;
  private golfModels: GolfSceneModels;

  /**
   * ========== LAYER 3: PHYSICS ==========
   */
  private greenTerrain: GreenTerrain;
  private ballPhysics: BallPhysics;
  private physicsEngine: PhysicsEngine;

  /**
   * ========== LAYER 1: UI & INPUT ==========
   */
  private inputHandler: InputHandler;
  private cameraController: FirstPersonCamera;

  /**
   * ========== LAYER 2: STATE ==========
   */
  private gameState: GameState;
  private hitController: HitController;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gameState = this.createInitialGameState();

    // Initialize sizes (used by multiple systems)
    this.sizes = new Sizes();

    // ========== INITIALIZE LAYER 3: PHYSICS ==========
    console.log('🏌️ Initializing physics...');
    this.greenTerrain = new GreenTerrain();
    this.ballPhysics = new BallPhysics(
      'ball',
      new THREE.Vector3(0, 0.2, 0), // Start at (0, height, 0)
      this.greenTerrain,
    );
    this.physicsEngine = new PhysicsEngine(this.greenTerrain);
    this.physicsEngine.addObject(this.ballPhysics);

    // ========== INITIALIZE LAYER 1: INPUT & CAMERA ==========
    console.log('🎮 Initializing input...');
    this.inputHandler = new InputHandler(this.canvas);
    this.cameraController = new FirstPersonCamera(this.inputHandler);

    // ========== INITIALIZE LAYER 4: RENDERING ==========
    console.log('🎨 Initializing rendering...');
    this.renderer = new Renderer(canvas, this.sizes);
    this.sceneManager = new SceneManager();

    // Create terrain mesh from physics data
    this.greenRenderer = new GreenRenderer(this.greenTerrain);
    this.sceneManager.add(this.greenRenderer.getMesh());

    // Models own their placeholders and can later accept loaded GLTF scenes.
    this.golfModels = new GolfSceneModels(this.greenTerrain, this.ballPhysics.getRadius());
    this.sceneManager.add(this.golfModels.getObject3D());

    // Application-layer bridge between input, physics and the club visual.
    this.hitController = new HitController(
      this.physicsEngine,
      this.ballPhysics,
      this.golfModels.club.getObject3D(),
      HIT_STRENGTH_LEVELS,
    );
    this.setupInputHandlers();

    // Setup camera
    this.cameraSystem = new CameraSystem(
      this.sizes.width / this.sizes.height,
      this.cameraController,
    );

    // ========== INITIALIZE GAME LOOP ==========
    console.log('▶️ Starting game loop...');
    this.loop = new Loop();
    this.loop.onTick((deltaTime) => this.update(deltaTime));
    this.loop.start();

    // Handle window resize
    this.sizes.onResize(() => this.onResize());

    console.log('✅ Game initialized!');
    console.log('Hit controls: H = hit, 1-3 = strength, [ / ] = previous / next level');
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
    };
  }

  /**
   * Setup input event handlers.
   * Bridges Layer 1 (input) with Layer 2 (orchestration).
   */
  private setupInputHandlers(): void {
    this.inputHandler.onPointerLockChange((isLocked) => {
      document.body.classList.toggle('camera-locked', isLocked);
    });

    this.inputHandler.onKeyDown((key) => {
      if (key === 'h' || key === 'H') {
        this.performHit();
      }
      if (key === 'r' || key === 'R') {
        this.resetBall();
      }
      if (this.hitController.selectLevelFromNumberKey(key)) {
        this.logSelectedHitLevel();
      }
      if (key === '[') {
        this.hitController.selectPreviousLevel();
        this.logSelectedHitLevel();
      }
      if (key === ']') {
        this.hitController.selectNextLevel();
        this.logSelectedHitLevel();
      }
    });
  }

  /**
   * Perform a swing.
   * Called by input handler.
   * Bridges Layer 1 (input) → Layer 2 (command) → Layer 3 (physics).
   */
  private performHit(): void {
    const aimDirection = this.golfModels.hole
      .getObject3D()
      .getWorldPosition(new THREE.Vector3())
      .sub(this.ballPhysics.getPosition());
    const result = this.hitController.hit(aimDirection);

    if (result?.didHit) {
      this.gameState.isBallMoving = true;
      this.gameState.score += 1;
    }
  }

  private logSelectedHitLevel(): void {
    const level = this.hitController.getSelectedLevel();
    console.log(`Hit strength: ${level.name} (${level.clubHeadSpeed} m/s club speed)`);
  }

  /**
   * Reset ball position.
   */
  private resetBall(): void {
    this.ballPhysics.setPosition(new THREE.Vector3(0, 0, 0));
    this.ballPhysics.reset();
    this.hitController.reset();
    this.gameState.isBallMoving = false;
    this.gameState.score = 0;
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
    // === LAYER 3: UPDATE PHYSICS ===
    this.physicsEngine.update(deltaTime);
    this.hitController.update(deltaTime);

    // === LAYER 2: UPDATE GAME STATE ===
    this.gameState.ballPosition.copy(this.ballPhysics.getPosition());
    this.gameState.ballVelocity.copy(this.ballPhysics.getVelocity());
    this.gameState.isBallMoving = this.ballPhysics.isActive();

    // The spectator camera updates only from input, never from physics state.
    this.cameraController.update(deltaTime);

    // === LAYER 4: SYNC RENDERING ===
    this.golfModels.syncBall(
      this.gameState.ballPosition,
      this.ballPhysics.getRotation(),
    );

    // Update camera in the Three.js scene
    this.cameraSystem.update(
      this.cameraController.getPosition(),
      this.cameraController.getTarget(),
    );

    // === RENDER FRAME ===
    this.renderer.render(this.sceneManager.getScene(), this.cameraSystem.getCamera());
  }

  /**
   * Handle window resize.
   */
  private onResize(): void {
    // Notify all systems that size changed
    this.cameraSystem.updateAspect(this.sizes.width / this.sizes.height);
    this.renderer.updateSize(this.sizes);
  }

  /**
   * Cleanup when closing the app.
   */
  dispose(): void {
    console.log('🧹 Cleaning up...');
    this.loop.dispose();
    this.cameraController.dispose();
    this.inputHandler.dispose();
    document.body.classList.remove('camera-locked');
    this.golfModels.dispose();
    this.greenRenderer.dispose();
    this.renderer.dispose();
    this.sizes.dispose();
  }
}
