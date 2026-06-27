# Golf Ball Physics Study

This folder is a self-contained physics layer. It has no mesh, camera, UI or
input dependencies. Values are expressed in SI units.

## Scope and assumptions

- The ball is a rigid, uniform sphere.
- The golf club is reduced to the effective head mass, head velocity and face
  normal at the instant of contact.
- The terrain is a continuous height field sampled from Perlin noise.
- Wind is uniform. Weather, ball deformation, dimples and grass blades are
  represented by coefficients rather than individually simulated.
- A fixed 240 Hz substep is used inside each frame. This is sufficient for a
  third-year simulation and prevents most ground tunnelling.

Default regulation-ball values:

| Quantity | Value |
| --- | ---: |
| Mass | 0.04593 kg |
| Radius | 0.02135 m |
| Air density | 1.225 kg/m3 |
| Drag coefficient | 0.25 |
| Gravity | 9.81 m/s2 |

## 1. Club impact

The normal collision impulse is:

```text
Jn = (1 + e) * closingSpeed / (1 / ballMass + 1 / effectiveClubMass)
```

`e` is the club-ball coefficient of restitution. A tangential impulse, limited
by `friction * Jn`, transfers off-centre face motion to ball spin. For a solid
sphere the moment of inertia is:

```text
I = (2 / 5) * mass * radius^2
```

The launch velocity and angular velocity follow from impulse-momentum:

```text
velocityChange = impulse / mass
angularVelocityChange = (contactOffset x impulse) / I
```

A lofted face normal produces the upward launch component. `ClubImpact` models
this calculation; it does not prescribe a visual club animation.

## 2. Airborne motion

Three forces are summed while the ball is in flight.

Gravity:

```text
Fg = mass * gravity
```

Quadratic drag, opposite the ball's velocity relative to the wind:

```text
Fd = 0.5 * airDensity * dragCoefficient * area * airSpeed^2
area = pi * radius^2
```

Magnus lift from spin:

```text
spinRatio = angularSpeed * radius / airSpeed
liftCoefficient = min(maximumLift, magnusCoefficient * spinRatio)
Fl = 0.5 * airDensity * liftCoefficient * area * airSpeed^2
direction = normalize(angularVelocity x relativeAirVelocity)
```

The forces are integrated with semi-implicit Euler: acceleration changes the
velocity first, then the new velocity changes the position.

## 3. Uneven-ground collision

`GreenTerrain` bilinearly interpolates its height map and estimates the local
surface normal from the height gradient. The ball centre is kept one radius
away from that local surface.

At impact, velocity is split into normal and tangential components. The normal
component is reversed and reduced by the ground restitution. Coulomb-style
impact friction is capped by the normal impulse and changes both linear motion
and spin. A sufficiently energetic rebound returns the ball to the airborne
state; a small rebound becomes ground motion.

## 4. Rolling on a slope

Gravity is projected onto the tangent plane:

```text
slopeAcceleration = gravity - normal * dot(gravity, normal)
```

Immediately after landing, the contact point can slide over the grass. Kinetic
friction acts against that slip and creates torque until the no-slip rolling
condition is reached. Rolling resistance then acts opposite travel:

```text
rollingResistanceAcceleration = coefficient * gravity
```

If downhill acceleration cannot overcome rolling resistance and ball speed is
below the stop threshold, the ball enters the resting state. Otherwise it can
continue rolling downhill. No-slip angular velocity is calculated from the
surface normal and linear velocity.

## Example for future controller integration

```ts
const faceNormal = ClubImpact.createFaceNormal(new THREE.Vector3(0, 0, -1), 18)

physicsEngine.hitBall(ball, {
  clubHeadVelocity: new THREE.Vector3(0, 0, -32),
  faceNormal,
  effectiveClubMass: 0.2,
})
```

This example is intentionally not connected to the current input or rendering
layers.
