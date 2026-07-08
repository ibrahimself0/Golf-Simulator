import * as THREE from 'three'

export class TrajectoryPreviewRenderer {
  private readonly root = new THREE.Group()
  private readonly lineMaterial = new THREE.LineBasicMaterial({
    color: 0x168dff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
  private readonly pointMaterial = new THREE.PointsMaterial({
    color: 0x168dff,
    transparent: true,
    opacity: 0.3,
    size: 0.22,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
  private line: THREE.Line | null = null
  private pointsObject: THREE.Points | null = null

  constructor() {
    this.root.name = 'trajectory-preview'
    this.root.visible = false
  }

  setPoints(points: THREE.Vector3[]): void {
    this.clearMesh()

    if (points.length < 2) {
      this.root.visible = false
      return
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    this.line = new THREE.Line(geometry, this.lineMaterial)
    this.pointsObject = new THREE.Points(geometry.clone(), this.pointMaterial)
    this.line.renderOrder = 20
    this.pointsObject.renderOrder = 21
    this.root.add(this.line, this.pointsObject)
    this.root.visible = true
  }

  setVisible(isVisible: boolean): void {
    this.root.visible = isVisible && this.line !== null
  }

  getObject3D(): THREE.Group {
    return this.root
  }

  dispose(): void {
    this.clearMesh()
    this.lineMaterial.dispose()
    this.pointMaterial.dispose()
    this.root.clear()
  }

  private clearMesh(): void {
    if (this.line) {
      this.root.remove(this.line)
      this.line.geometry.dispose()
      this.line = null
    }
    if (this.pointsObject) {
      this.root.remove(this.pointsObject)
      this.pointsObject.geometry.dispose()
      this.pointsObject = null
    }
  }
}
