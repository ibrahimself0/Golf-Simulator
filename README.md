# Three.js MVC Template

A clean, scalable starting point for Three.js projects — built with **Vite**, **TypeScript**, **ESLint/Prettier**, and **GitHub Actions CI**.

## Stack

| Tool | Purpose |
|------|---------|
| [Three.js](https://threejs.org/) | 3D rendering |
| [Vite](https://vitejs.dev/) | Dev server + bundler |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) | Code quality |
| [GitHub Actions](https://docs.github.com/en/actions) | CI pipeline |

---

## Getting Started

```bash
# 1. Clone and install
npm install

# 2. Start the dev server (opens at http://localhost:3000)
npm run dev
```

## Controls

Click the canvas to capture the mouse. Press `Escape` to release it.

| Input | Action |
|------|--------|
| Mouse | Look around |
| `WASD` or arrow keys | Fly forward, backward, left, and right |
| `Space` | Fly up |
| `Shift` | Fly down |
| `H` | Hit the ball toward the hole |
| `R` | Reset the ball |
| `1`-`3`, `[` / `]` | Select hit strength |

The spectator camera is independent of the ball physics and does not change the shot direction.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint and auto-fix issues |
| `npm run format` | Format all files with Prettier |
| `npm run format:check` | Check formatting (used in CI) |
| `npm run typecheck` | Run TypeScript compiler without emitting |

---

## Project Structure

```
src/
├── controllers/
│   └── AppController.ts   # Orchestrates everything — entry point into MVC
├── models/
│   └── SceneModel.ts      # Three.js scene graph + state
├── views/
│   └── SceneView.ts       # Lights, environment, camera aspect updates
├── core/
│   ├── Renderer.ts        # WebGLRenderer setup and resize handling
│   └── Loop.ts            # requestAnimationFrame loop with delta time
├── utils/
│   └── Sizes.ts           # Reactive window dimensions + resize events
└── main.ts                # Bootstrap: grabs canvas, creates AppController
```

### MVC Responsibilities

- **Model** (`SceneModel`) — owns the scene graph and all stateful data. No rendering logic.
- **View** (`SceneView`) — lights, post-processing, camera updates. Reads from Model.
- **Controller** (`AppController`) — creates and connects all subsystems, drives the loop.

---

## CI Pipeline

On every push / pull request to `main` or `develop`, GitHub Actions runs:

1. **Prettier** format check
2. **ESLint** lint
3. **TypeScript** type-check
4. **Vite** production build
5. Uploads `dist/` as a build artifact (retained for 7 days)

---

## Extending the Template

- **Add a new object** → create it in `SceneModel`, update it in `SceneModel.update()`.
- **Add post-processing** → install `postprocessing` or use Three's `EffectComposer` in `Renderer.ts`.
- **Add controls** → install `@types/three` (already included) and add `OrbitControls` in `SceneView.ts`.
- **Split into multiple scenes** → add more model/view pairs; the controller composes them.
