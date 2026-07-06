import * as THREE from 'three'
import type { ShotSettings } from '../../application/hit/ShotSettings'
import type { BallMotionState } from '../../domain/physics/PhysicsTypes'

export interface SimulationControlValues extends ShotSettings {
  ballMass: number
  ballRadius: number
  gravity: number
  airDensity: number
  dragCoefficient: number
  magnusCoefficient: number
  maximumLiftCoefficient: number
  bounce: number
  impactFriction: number
  slidingFriction: number
  rollingResistance: number
  slopeStrength: number
  stopSpeed: number
  bounceSpeed: number
  terrainRoughness: number
  terrainSeed: number
  windStrength: number
  windDirectionDegrees: number
  timeScale: number
  maximumDeltaTime: number
  simulationStep: number
  showTrajectoryPreview: boolean
}

interface RuntimePanelState {
  position: THREE.Vector3
  velocity: THREE.Vector3
  acceleration: THREE.Vector3
  angularVelocity: THREE.Vector3
  motionState: BallMotionState
  isActive: boolean
  canHit: boolean
  score: number
  currentHole: number
  distanceToHole: number
  heightAboveTerrain: number
  simulationTime: number
  clubHeadSpeed: number
  fps: number
  controls: Readonly<SimulationControlValues>
}

interface SimulationPanelsOptions {
  controls: SimulationControlValues
  onControlsChange: (controls: SimulationControlValues) => void
}

interface NumericControlDescriptor {
  key: keyof SimulationControlValues
  label: string
  min: number
  max: number
  step: number
  unit?: string
  inputType?: 'slider' | 'number'
  valueType?: 'number'
}

interface BooleanControlDescriptor {
  key: keyof SimulationControlValues
  label: string
  valueType: 'boolean'
}

type ControlDescriptor = NumericControlDescriptor | BooleanControlDescriptor

const CONTROL_SECTIONS: Array<{
  title: string
  controls: ControlDescriptor[]
}> = [
  {
    title: 'Course',
    controls: [
      { key: 'terrainSeed', label: 'Seed', min: 0, max: 9999, step: 1, inputType: 'number' },
      { key: 'showTrajectoryPreview', label: 'Show trace', valueType: 'boolean' },
    ],
  },
  {
    title: 'Hit Settings',
    controls: [
      { key: 'hitPower', label: 'Hit power', min: 0, max: 100, step: 1, unit: '%' },
      { key: 'minClubHeadSpeed', label: 'Min speed', min: 0, max: 20, step: 0.1, unit: 'm/s' },
      { key: 'maxClubHeadSpeed', label: 'Max speed', min: 5, max: 60, step: 0.1, unit: 'm/s' },
      { key: 'launchAngleDegrees', label: 'Launch angle', min: 0, max: 45, step: 0.5, unit: '°' },
      { key: 'directionDegrees', label: 'Direction', min: 0, max: 360, step: 0.1, unit: '°' },
      { key: 'spinPercent', label: 'Spin', min: -100, max: 100, step: 1, unit: '%' },
      { key: 'sideSpinPercent', label: 'Side spin', min: -100, max: 100, step: 1, unit: '%' },
      { key: 'effectiveClubMass', label: 'Club mass', min: 0.05, max: 1, step: 0.01, unit: 'kg' },
      { key: 'restitution', label: 'Club restitution', min: 0, max: 1, step: 0.01 },
      { key: 'friction', label: 'Club friction', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Ball',
    controls: [
      { key: 'ballMass', label: 'Mass', min: 0.03, max: 0.08, step: 0.0005, unit: 'kg' },
      { key: 'ballRadius', label: 'Radius', min: 0.015, max: 0.035, step: 0.0005, unit: 'm' },
      { key: 'bounce', label: 'Bounce', min: 0, max: 1, step: 0.01 },
      { key: 'dragCoefficient', label: 'Air drag', min: 0, max: 1, step: 0.01 },
      { key: 'magnusCoefficient', label: 'Magnus effect', min: 0, max: 1, step: 0.01 },
      { key: 'maximumLiftCoefficient', label: 'Max lift', min: 0, max: 1, step: 0.01 },
      { key: 'airDensity', label: 'Air density', min: 0, max: 2, step: 0.01, unit: 'kg/m³' },
    ],
  },
  {
    title: 'Ground',
    controls: [
      { key: 'slidingFriction', label: 'Sliding friction', min: 0, max: 1, step: 0.01 },
      { key: 'impactFriction', label: 'Impact friction', min: 0, max: 1, step: 0.01 },
      { key: 'rollingResistance', label: 'Rolling resistance', min: 0, max: 1, step: 0.01 },
      { key: 'terrainRoughness', label: 'Terrain roughness', min: 0, max: 1, step: 0.01 },
      { key: 'slopeStrength', label: 'Slope strength', min: 0, max: 2, step: 0.01 },
      { key: 'stopSpeed', label: 'Stop speed', min: 0, max: 1, step: 0.01, unit: 'm/s' },
      { key: 'bounceSpeed', label: 'Bounce speed', min: 0, max: 2, step: 0.01, unit: 'm/s' },
    ],
  },
  {
    title: 'Environment',
    controls: [
      { key: 'gravity', label: 'Gravity', min: 1, max: 20, step: 0.01, unit: 'm/s²' },
      { key: 'windStrength', label: 'Wind strength', min: 0, max: 30, step: 0.1, unit: 'm/s' },
      {
        key: 'windDirectionDegrees',
        label: 'Wind direction',
        min: 0,
        max: 360,
        step: 1,
        unit: '°',
      },
      { key: 'timeScale', label: 'Time scale', min: 0.1, max: 2, step: 0.01, unit: 'x' },
      { key: 'maximumDeltaTime', label: 'Max delta', min: 0.01, max: 0.2, step: 0.001, unit: 's' },
      {
        key: 'simulationStep',
        label: 'Physics step',
        min: 0.001,
        max: 0.02,
        step: 0.0005,
        unit: 's',
      },
    ],
  },
]

/** Minimal simulation panels with live data on the left and functional controls on the right. */
export class SimulationPanels {
  private readonly root: HTMLDivElement
  private readonly runtimePanel: HTMLDivElement
  private readonly runtimeBody: HTMLDivElement
  private readonly physicsPanel: HTMLDivElement
  private readonly physicsBody: HTMLDivElement
  private readonly completionPopup: HTMLDivElement
  private readonly onControlsChange: (controls: SimulationControlValues) => void
  private readonly controlsByKey = new Map<
    keyof SimulationControlValues,
    { range?: HTMLInputElement; number?: HTMLInputElement; checkbox?: HTMLInputElement; descriptor: ControlDescriptor }
  >()
  private controls: SimulationControlValues
  private statusMessageTimeout: number | null = null

  constructor(options: SimulationPanelsOptions) {
    this.controls = { ...options.controls }
    this.onControlsChange = options.onControlsChange
    this.root = document.createElement('div')
    this.root.className = 'simulation-panels'
    this.root.addEventListener('keydown', (event) => event.stopPropagation())
    this.root.addEventListener('keyup', (event) => event.stopPropagation())

    const runtime = this.createPanel('Simulation', 'runtime-panel')
    this.runtimePanel = runtime.panel
    this.runtimeBody = runtime.body

    const physics = this.createPanel('Physics Inspector', 'physics-panel')
    this.physicsPanel = physics.panel
    this.physicsBody = physics.body

    this.completionPopup = document.createElement('div')
    this.completionPopup.className = 'sim-complete-popup'
    this.completionPopup.hidden = true

    this.root.append(this.runtimePanel, this.physicsPanel, this.completionPopup)
    document.body.appendChild(this.root)
    this.renderControlsPanel()
  }

  update(state: RuntimePanelState): void {
    const speed = state.velocity.length()
    const spinSpeed = state.angularVelocity.length()

    this.runtimeBody.innerHTML = ''
    this.runtimeBody.append(
      this.createSection('Performance'),
      this.createRow('FPS', this.formatNumber(state.fps, 0)),
      this.createSection('Ball'),
      this.createRow('State', state.motionState),
      this.createRow('Active', state.isActive ? 'true' : 'false'),
      this.createRow('Can Hit', state.canHit ? 'Yes' : 'No'),
      this.createRow('Position', this.formatVector(state.position, 3)),
      this.createRow('Velocity', this.formatVector(state.velocity, 3)),
      this.createRow('Acceleration', this.formatVector(state.acceleration, 3)),
      this.createRow('Speed', `${this.formatNumber(speed, 3)} m/s`),
      this.createRow('Angular velocity', this.formatVector(state.angularVelocity, 3)),
      this.createRow('Spin speed', `${this.formatNumber(spinSpeed, 3)} rad/s`),
      this.createRow('Height above terrain', `${this.formatNumber(state.heightAboveTerrain, 3)} m`),
      this.createRow('Distance to hole', `${this.formatNumber(state.distanceToHole, 2)} m`),
      this.createSection('Shot'),
      this.createRow('Hole', String(state.currentHole)),
      this.createRow('Strokes', String(state.score)),
      this.createRow('Hit power', `${this.formatNumber(state.controls.hitPower, 0)}%`),
      this.createRow('Club speed', `${this.formatNumber(state.clubHeadSpeed, 2)} m/s`),
      this.createRow('Launch angle', `${this.formatNumber(state.controls.launchAngleDegrees, 1)}°`),
      this.createRow('Direction', `${this.formatNumber(state.controls.directionDegrees, 1)}°`),
      this.createRow('Spin', `${this.formatNumber(state.controls.spinPercent, 0)}%`),
      this.createRow('Side spin', `${this.formatNumber(state.controls.sideSpinPercent, 0)}%`),
      this.createSection('Environment'),
      this.createRow('Simulation time', `${this.formatNumber(state.simulationTime, 2)} s`),
      this.createRow('Seed', `${this.formatNumber(state.controls.terrainSeed, 0)}`),
      this.createRow('Time scale', `${this.formatNumber(state.controls.timeScale, 2)}x`),
      this.createRow(
        'Wind',
        `${this.formatNumber(state.controls.windStrength, 1)} m/s @ ${this.formatNumber(state.controls.windDirectionDegrees, 0)}°`
      )
    )
  }

  showCompletionMessage(strokes: number): void {
    if (this.statusMessageTimeout !== null) {
      window.clearTimeout(this.statusMessageTimeout)
      this.statusMessageTimeout = null
    }
    const strokeLabel = strokes === 1 ? 'stroke' : 'strokes'
    this.completionPopup.textContent = `Scored in ${strokes} ${strokeLabel}!`
    this.completionPopup.hidden = false
  }

  hideCompletionMessage(): void {
    this.completionPopup.hidden = true
  }

  showStatusMessage(message: string, durationMs = 2600): void {
    if (this.statusMessageTimeout !== null) {
      window.clearTimeout(this.statusMessageTimeout)
    }

    this.completionPopup.textContent = message
    this.completionPopup.hidden = false
    this.statusMessageTimeout = window.setTimeout(() => {
      this.completionPopup.hidden = true
      this.statusMessageTimeout = null
    }, durationMs)
  }

  dispose(): void {
    if (this.statusMessageTimeout !== null) {
      window.clearTimeout(this.statusMessageTimeout)
    }
    this.root.remove()
  }

  private createPanel(
    title: string,
    className: string
  ): {
    panel: HTMLDivElement
    body: HTMLDivElement
  } {
    const panel = document.createElement('div')
    panel.className = `sim-panel ${className}`

    const header = document.createElement('button')
    header.type = 'button'
    header.className = 'sim-panel__header'
    header.setAttribute('aria-expanded', 'true')

    const titleElement = document.createElement('span')
    titleElement.textContent = title

    const toggleIcon = document.createElement('span')
    toggleIcon.className = 'sim-panel__toggle'
    toggleIcon.textContent = '–'
    toggleIcon.setAttribute('aria-hidden', 'true')

    const body = document.createElement('div')
    body.className = 'sim-panel__body'

    header.append(titleElement, toggleIcon)
    header.addEventListener('click', () => {
      const isCollapsed = panel.classList.toggle('is-collapsed')
      header.setAttribute('aria-expanded', String(!isCollapsed))
      toggleIcon.textContent = isCollapsed ? '+' : '–'
    })

    panel.append(header, body)
    return { panel, body }
  }

  private renderControlsPanel(): void {
    this.physicsBody.innerHTML = ''
    this.controlsByKey.clear()

    for (const section of CONTROL_SECTIONS) {
      this.physicsBody.append(this.createSection(section.title))
      for (const descriptor of section.controls) {
        this.physicsBody.append(this.createControl(descriptor))
      }
    }
  }

  private createControl(descriptor: ControlDescriptor): HTMLElement {
    const row = document.createElement('label')
    row.className = 'sim-panel__control'

    const label = document.createElement('span')
    label.className = 'sim-panel__control-label'
    label.textContent = descriptor.label

    if (descriptor.valueType === 'boolean') {
      const inputs = document.createElement('span')
      inputs.className = 'sim-panel__control-inputs sim-panel__control-inputs--checkbox'

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = Boolean(this.controls[descriptor.key])
      checkbox.addEventListener('change', () => {
        this.setBooleanControlValue(descriptor, checkbox.checked)
      })

      inputs.append(checkbox)
      row.append(label, inputs)
      this.controlsByKey.set(descriptor.key, { checkbox, descriptor })
      return row
    }

    const inputs = document.createElement('span')
    inputs.className =
      descriptor.inputType === 'number'
        ? 'sim-panel__control-inputs sim-panel__control-inputs--number-only'
        : 'sim-panel__control-inputs'

    const range = descriptor.inputType === 'number' ? undefined : document.createElement('input')
    if (range) {
      range.type = 'range'
      range.min = String(descriptor.min)
      range.max = String(descriptor.max)
      range.step = String(descriptor.step)
      range.value = String(this.controls[descriptor.key])
    }

    const number = document.createElement('input')
    number.type = 'number'
    number.min = String(descriptor.min)
    number.max = String(descriptor.max)
    number.step = String(descriptor.step)
    number.value = this.formatControlValue(Number(this.controls[descriptor.key]), descriptor)

    const unit = document.createElement('span')
    unit.className = 'sim-panel__unit'
    unit.textContent = descriptor.unit ?? ''

    range?.addEventListener('input', () => {
      this.setControlValue(descriptor, Number.parseFloat(range.value))
    })

    const numberEvent = descriptor.inputType === 'number' ? 'change' : 'input'
    number.addEventListener(numberEvent, () => {
      this.setControlValue(descriptor, Number.parseFloat(number.value))
    })

    if (range) {
      inputs.append(range)
    }
    inputs.append(number, unit)
    row.append(label, inputs)
    this.controlsByKey.set(descriptor.key, { range, number, descriptor })

    return row
  }

  private setControlValue(descriptor: NumericControlDescriptor, rawValue: number): void {
    if (!Number.isFinite(rawValue)) {
      return
    }

    const value = THREE.MathUtils.clamp(rawValue, descriptor.min, descriptor.max)
    ;(this.controls as unknown as Record<string, number>)[String(descriptor.key)] = value

    const pair = this.controlsByKey.get(descriptor.key)
    if (pair) {
      if (pair.range) {
        pair.range.value = String(value)
      }
      if (pair.number) {
        pair.number.value = this.formatControlValue(value, descriptor)
      }
    }

    this.onControlsChange({ ...this.controls })
  }

  private setBooleanControlValue(descriptor: BooleanControlDescriptor, value: boolean): void {
    ;(this.controls as unknown as Record<string, boolean>)[String(descriptor.key)] = value
    const pair = this.controlsByKey.get(descriptor.key)
    if (pair?.checkbox) {
      pair.checkbox.checked = value
    }
    this.onControlsChange({ ...this.controls })
  }

  private createSection(label: string): HTMLDivElement {
    const element = document.createElement('div')
    element.className = 'sim-panel__section'
    element.textContent = label
    return element
  }

  private createRow(label: string, value: string): HTMLDivElement {
    const row = document.createElement('div')
    row.className = 'sim-panel__row'

    const labelElement = document.createElement('span')
    labelElement.className = 'sim-panel__label'
    labelElement.textContent = label

    const valueElement = document.createElement('span')
    valueElement.className = 'sim-panel__value'
    valueElement.textContent = value

    row.append(labelElement, valueElement)
    return row
  }

  private formatVector(vector: THREE.Vector3, fractionDigits: number): string {
    return `${this.formatNumber(vector.x, fractionDigits)}, ${this.formatNumber(
      vector.y,
      fractionDigits
    )}, ${this.formatNumber(vector.z, fractionDigits)}`
  }

  private formatControlValue(value: number, descriptor: NumericControlDescriptor): string {
    return this.formatNumber(value, this.getStepFractionDigits(descriptor.step))
  }

  private getStepFractionDigits(step: number): number {
    const [, fraction = ''] = String(step).split('.')
    return fraction.length
  }

  private formatNumber(value: number, fractionDigits: number): string {
    return Number.isFinite(value) ? value.toFixed(fractionDigits) : '—'
  }
}
