export interface ShotSettings {
  hitPower: number
  minClubHeadSpeed: number
  maxClubHeadSpeed: number
  launchAngleDegrees: number
  directionDegrees: number
  spinPercent: number
  sideSpinPercent: number
  effectiveClubMass: number
  restitution: number
  friction: number
}

export const DEFAULT_SHOT_SETTINGS: Readonly<ShotSettings> = {
  hitPower: 50,
  minClubHeadSpeed: 2,
  maxClubHeadSpeed: 45,
  launchAngleDegrees: 18,
  directionDegrees: 0,
  spinPercent: 20,
  sideSpinPercent: 0,
  effectiveClubMass: 0.2,
  restitution: 0.76,
  friction: 0.2,
}
