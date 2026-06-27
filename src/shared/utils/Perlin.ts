/**
 * ============================================================================
 * SIMPLE PERLIN NOISE
 * ============================================================================
 *
 * Generates smooth, continuous noise for realistic terrain.
 * This is a simplified implementation — not the fastest, but clean and easy to understand.
 *
 * Used by GreenTerrain to create uneven golf greens.
 */

export class Perlin {
  /**
   * Permutation table — randomizes where we sample the gradient grid.
   * Standard Perlin noise uses a fixed 256-element table.
   */
  private permutation: number[] = [];

  /**
   * Extended permutation table (doubled for easier lookup).
   */
  private p: number[] = [];

  constructor(seed: number = 0) {
    // Initialize permutation table
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }

    // Shuffle using seeded random
    const rng = this.seededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }

    // Double the table for wraparound
    this.p = [...this.permutation, ...this.permutation];
  }

  /**
   * Generate a pseudo-random number from a seed.
   * Produces consistent results for the same seed.
   */
  private seededRandom(seed: number) {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  /**
   * Perlin noise value at (x, y).
   * Returns value in range [-1, 1].
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Noise value in [-1, 1]
   */
  noise(x: number, y: number): number {
    // Find grid cell
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;

    // Position within grid cell
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Fade curves (smooth step function)
    const u = this.fade(xf);
    const v = this.fade(yf);

    // Hash of the four corners
    const n00 = this.p[this.p[xi] + yi];
    const n10 = this.p[this.p[xi + 1] + yi];
    const n01 = this.p[this.p[xi] + yi + 1];
    const n11 = this.p[this.p[xi + 1] + yi + 1];

    // Gradients at the four corners
    const g00 = this.gradient(n00, xf, yf);
    const g10 = this.gradient(n10, xf - 1, yf);
    const g01 = this.gradient(n01, xf, yf - 1);
    const g11 = this.gradient(n11, xf - 1, yf - 1);

    // Bilinear interpolation
    const nx0 = this.lerp(g00, g10, u);
    const nx1 = this.lerp(g01, g11, u);
    const value = this.lerp(nx0, nx1, v);

    return value;
  }

  /**
   * Fade function — smooth interpolation curve.
   * Creates the characteristic "smooth" appearance of Perlin noise.
   */
  private fade(t: number): number {
    // Perlin's improved fade: 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Linear interpolation between a and b.
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Gradient function — dot product of gradient vector with distance vector.
   */
  private gradient(hash: number, x: number, y: number): number {
    const h = hash & 15; // Take lowest 4 bits
    const u = h < 8 ? x : y;
    const v = h < 8 ? y : x;

    // Four predetermined gradient directions
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
}
