/** Centralizes keyboard state and pointer-lock mouse input. */
export class InputHandler {
  private readonly canvas: HTMLCanvasElement
  private readonly keysPressed = new Set<string>()
  private readonly keyDownCallbacks: Array<(key: string) => void> = []
  private readonly keyUpCallbacks: Array<(key: string) => void> = []
  private readonly mouseMoveCallbacks: Array<
    (deltaX: number, deltaY: number) => void
  > = []
  private readonly mouseDragCallbacks: Array<
    (deltaX: number, deltaY: number) => void
  > = []
  private readonly wheelCallbacks: Array<(deltaY: number) => void> = []
  private readonly pointerLockCallbacks: Array<(isLocked: boolean) => void> = []
  private isMouseDown = false
  private pointerLockEnabled = true

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.clearPressedKeys)
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('pointerlockchange', this.handlePointerLockChange)
    this.canvas.addEventListener('click', this.capturePointer)
    this.canvas.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mouseup', this.handleMouseUp)
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false })
  }

  private normalizeKey(key: string): string {
    if (key === ' ' || key === 'Spacebar') return 'space'
    return key.toLowerCase()
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const key = this.normalizeKey(event.key)
    this.keysPressed.add(key)

    if (this.isPointerLocked() && this.isCameraKey(key)) {
      event.preventDefault()
    }

    this.keyDownCallbacks.forEach((callback) => callback(event.key))
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keysPressed.delete(this.normalizeKey(event.key))
    this.keyUpCallbacks.forEach((callback) => callback(event.key))
  }

  private handleMouseMove = (event: MouseEvent): void => {
    if (this.isPointerLocked()) {
      this.mouseMoveCallbacks.forEach((callback) =>
        callback(event.movementX, event.movementY)
      )
      return
    }

    if (this.isMouseDown) {
      this.mouseDragCallbacks.forEach((callback) =>
        callback(event.movementX, event.movementY)
      )
    }
  }

  private handlePointerLockChange = (): void => {
    const isLocked = this.isPointerLocked()
    if (!isLocked) this.clearPressedKeys()
    this.pointerLockCallbacks.forEach((callback) => callback(isLocked))
  }

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button === 0 && !this.isPointerLocked()) {
      this.isMouseDown = true
    }
  }

  private handleMouseUp = (): void => {
    this.isMouseDown = false
  }

  private handleWheel = (event: WheelEvent): void => {
    if (this.wheelCallbacks.length === 0) {
      return
    }
    event.preventDefault()
    this.wheelCallbacks.forEach((callback) => callback(event.deltaY))
  }

  private capturePointer = (): void => {
    if (this.pointerLockEnabled && !this.isPointerLocked()) {
      void this.canvas.requestPointerLock()
    }
  }

  private clearPressedKeys = (): void => {
    this.keysPressed.clear()
  }

  private isCameraKey(key: string): boolean {
    return [
      'w',
      'a',
      's',
      'd',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
      'space',
      'shift',
    ].includes(key)
  }

  onKeyDown(callback: (key: string) => void): void {
    this.keyDownCallbacks.push(callback)
  }

  onKeyUp(callback: (key: string) => void): void {
    this.keyUpCallbacks.push(callback)
  }

  onMouseMove(
    callback: (deltaX: number, deltaY: number) => void
  ): () => void {
    this.mouseMoveCallbacks.push(callback)
    return () => {
      const index = this.mouseMoveCallbacks.indexOf(callback)
      if (index >= 0) this.mouseMoveCallbacks.splice(index, 1)
    }
  }

  onMouseDrag(
    callback: (deltaX: number, deltaY: number) => void
  ): () => void {
    this.mouseDragCallbacks.push(callback)
    return () => {
      const index = this.mouseDragCallbacks.indexOf(callback)
      if (index >= 0) this.mouseDragCallbacks.splice(index, 1)
    }
  }

  onWheel(callback: (deltaY: number) => void): () => void {
    this.wheelCallbacks.push(callback)
    return () => {
      const index = this.wheelCallbacks.indexOf(callback)
      if (index >= 0) this.wheelCallbacks.splice(index, 1)
    }
  }

  setPointerLockEnabled(enabled: boolean): void {
    this.pointerLockEnabled = enabled
    if (!enabled && this.isPointerLocked()) {
      document.exitPointerLock()
    }
  }

  onPointerLockChange(callback: (isLocked: boolean) => void): void {
    this.pointerLockCallbacks.push(callback)
    callback(this.isPointerLocked())
  }

  isKeyPressed(key: string): boolean {
    return this.keysPressed.has(this.normalizeKey(key))
  }

  isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas
  }

  getPressedKeys(): string[] {
    return Array.from(this.keysPressed)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.clearPressedKeys)
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener(
      'pointerlockchange',
      this.handlePointerLockChange
    )
    this.canvas.removeEventListener('click', this.capturePointer)
    this.canvas.removeEventListener('mousedown', this.handleMouseDown)
    window.removeEventListener('mouseup', this.handleMouseUp)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    this.clearPressedKeys()
    if (this.isPointerLocked()) document.exitPointerLock()
  }
}
