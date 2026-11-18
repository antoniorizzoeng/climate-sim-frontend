import { defaults, type Boundary, type Conditions, type Plane } from './model';

type Example = {
  name: string;
  motion: string;
  nz?: number;
  vz?: number;
  preset?: 'gaussian_hotspot';
  D: number;
  vx: number;
  vy: number;
  dt: number;
  boundary?: Boundary;
  intensity: (x: number, y: number, noise: number) => number;
};
const gaussian = (x: number, y: number) => Math.exp(-0.5 * (x * x + y * y));

export const examples: Example[] = [
  {
    name: 'Crosswind plume',
    motion: 'Smoke drifts downwind',
    D: 0.12,
    vx: 1.2,
    vy: 0.13,
    dt: 0.48,
    intensity: (x, y) => {
      const tail = gaussian(
        (x - 0.27) / 0.19,
        (y - 0.48 - 0.13 * Math.sin(15 * x)) / (0.045 + 0.17 * x),
      );
      return tail * (0.68 + 0.32 * Math.cos(25 * x) ** 2);
    },
  },
  {
    name: 'Twin hotspots',
    motion: 'Two peaks diffuse together',
    D: 1.1,
    vx: 0,
    vy: 0,
    dt: 0.2,
    intensity: (x, y) =>
      gaussian((x - 0.45) / 0.038, (y - 0.47) / 0.09) +
      gaussian((x - 0.55) / 0.038, (y - 0.53) / 0.09),
  },
  {
    name: 'Traveling bands',
    motion: 'Stripes slide across the grid',
    D: 0.04,
    vx: -0.95,
    vy: 0.16,
    dt: 0.7,
    intensity: (x, y) =>
      (0.5 + 0.5 * Math.cos(27 * x + 4 * y + 1.7 * Math.sin(5 * y))) ** 3,
  },
  {
    name: 'Relaxing noise',
    motion: 'Fine grain spreads and softens',
    D: 0.5,
    vx: 0.15,
    vy: 0,
    dt: 0.4,
    intensity: (x, y, noise) =>
      (0.18 + 0.82 * noise) *
      (0.3 +
        0.7 * gaussian((x - 0.5) / 0.3, (y - 0.5 - 0.15 * Math.sin(11 * x)) / 0.18)),
  },
  {
    name: 'Wrap-around world',
    motion: 'Diagonal wind carries a peak across both edges',
    D: 0.03,
    vx: 1,
    vy: 0.65,
    dt: 0.55,
    boundary: 'periodic',
    intensity: (x, y) => gaussian((x - 0.78) / 0.055, (y - 0.73) / 0.11),
  },
  {
    name: 'Rising plume',
    motion: '3D · A warm core rises and drifts',
    preset: 'gaussian_hotspot',
    nz: 40,
    vz: 0.65,
    vx: 0.22,
    vy: -0.08,
    D: 0.035,
    dt: 0.5,
    intensity: (x, y) => gaussian((x - 0.5) / 0.05, (y - 0.5) / 0.05),
  },
  {
    name: 'Smoke ring diffusion',
    motion: '3D · A hollow ring softens',
    nz: 12,
    vz: 0,
    vx: 0.04,
    vy: 0.06,
    D: 0.32,
    dt: 0.4,
    intensity: (x, y) =>
      Math.exp(-0.5 * ((Math.hypot(x - 0.5, y - 0.5) - 0.28) / 0.043) ** 2),
  },
];

export function examplePlane(
  example: Example,
  nx = example.nz ? (example.preset ? 40 : 64) : 128,
  ny = example.nz ? nx : 64,
): Plane {
  let seed = 109;
  const data = Float32Array.from({ length: nx * ny }, (_, i) => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return Math.min(
      1,
      example.intensity(
        (i % nx) / (nx - 1),
        Math.floor(i / nx) / (ny - 1),
        seed / 2 ** 32,
      ),
    );
  });
  return { nx, ny, data };
}

export function exampleConditions(
  {
    D,
    vx,
    vy,
    dt,
    nz,
    vz,
    preset,
    boundary = preset ? 'periodic' : 'neumann',
  }: Example,
  supported: Boundary[],
): Conditions {
  const edge = supported.includes(boundary)
    ? boundary
    : supported.includes('neumann')
      ? 'neumann'
      : supported[0];
  return {
    ...defaults,
    D,
    vx,
    vy,
    dt,
    ...(nz && { nz, vz, dz: 1 }),
    steps: nz ? 48 : 120,
    frames: nz ? 25 : 41,
    bc: {
      left: edge,
      right: edge,
      top: edge,
      bottom: edge,
      ...(nz && {
        front: supported.includes('dirichlet') ? 'dirichlet' : edge,
        back: supported.includes('dirichlet') ? 'dirichlet' : edge,
      }),
    },
  };
}
