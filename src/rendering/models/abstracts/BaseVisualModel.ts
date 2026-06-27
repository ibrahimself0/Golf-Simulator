import * as THREE from 'three'

/**
 * Common wrapper for a temporary shape or a future imported model.
 * Replacing the child never changes the object's world transform.
 */
export abstract class BaseVisualModel {
  protected readonly root: THREE.Group
  private currentModel: THREE.Object3D | null = null

  protected constructor(name: string) {
    this.root = new THREE.Group()
    this.root.name = name
  }

  protected usePlaceholder(model: THREE.Object3D): void {
    this.currentModel = model
    this.root.add(model)
  }

  /** Accepts any Object3D, including a GLTF loader's gltf.scene. */
  replaceModel(model: THREE.Object3D): void {
    if (this.currentModel) {
      this.root.remove(this.currentModel)
      this.disposeObject(this.currentModel)
    }

    this.currentModel = model
    this.root.add(model)
  }

  getObject3D(): THREE.Group {
    return this.root
  }

  dispose(): void {
    if (this.currentModel) {
      this.disposeObject(this.currentModel)
      this.currentModel = null
    }
    this.root.clear()
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return
      }

      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        material.dispose()
      }
    })
  }
}
