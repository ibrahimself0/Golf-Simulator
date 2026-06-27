export interface HitStrengthLevel {
  id: string
  name: string
  clubHeadSpeed: number
  loftDegrees: number
  effectiveClubMass: number
  restitution: number
  friction: number
}

/**
 * Add, remove or tune hit levels here. Number keys select levels by their
 * position in this array; bracket keys can reach any additional levels.
 */
export const HIT_STRENGTH_LEVELS: readonly HitStrengthLevel[] = [
  {
    id: 'soft',
    name: 'Soft',
    clubHeadSpeed: 12,
    loftDegrees: 12,
    effectiveClubMass: 0.2,
    restitution: 0.72,
    friction: 0.18,
  },
  {
    id: 'normal',
    name: 'Normal',
    clubHeadSpeed: 22,
    loftDegrees: 16,
    effectiveClubMass: 0.2,
    restitution: 0.76,
    friction: 0.2,
  },
  {
    id: 'strong',
    name: 'Strong',
    clubHeadSpeed: 32,
    loftDegrees: 20,
    effectiveClubMass: 0.2,
    restitution: 0.78,
    friction: 0.22,
  },
]
