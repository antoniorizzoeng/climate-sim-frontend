import type { components } from './schema';

type S = components['schemas'];
export type Field = S['Field'];
export type Run = S['Run'];
export type RequestBody = S['RunRequest'];
export type Source = S['RunSource'];
export type Config = S['ServerConfig'];
export type Conditions = Omit<RequestBody, 'source'>;
export type Boundary = S['BoundaryCondition'];
export type ColorMap = S['Colormap'];
export type Plane = { nx: number; ny: number; data: Float32Array };
export type PlaneSelection = {
  field: Field;
  variable: string;
  index: Record<string, number>;
};
export type Pattern = 'Hotspot' | 'Stripes' | 'Noise' | 'Clear';

export const defaults: Conditions = {
  D: 0.08,
  vx: 0.8,
  vy: 0.25,
  dx: 1,
  dy: 1,
  dt: 0.5,
  steps: 400,
  frames: 101,
};
export function dtMax({ vx = 0, vy = 0, dx = 1, dy = 1, D = 0 }: Conditions) {
  const denominator =
    Math.abs(vx) / dx + Math.abs(vy) / dy + 2 * D * (1 / dx ** 2 + 1 / dy ** 2);
  return denominator === 0 ? null : 1 / denominator;
}
export function makePlane(
  nx = 320,
  ny = 160,
  pattern: Pattern = 'Hotspot',
  min = 0,
  max = 1,
): Plane {
  const data = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = i / (nx - 1),
        y = j / (ny - 1);
      const center =
        0.48 + 0.11 * Math.sin(8 * x - 3.5) + 0.075 * Math.sin(14 * x - 0.8);
      const width = 0.12 + 0.035 * Math.sin(9 * x - 1);
      const plume = Math.exp(
        -((x - 0.5) ** 2 / 0.097 + ((y - center) / width) ** 2 * 0.5),
      );
      const core =
        0.53 +
        0.52 * Math.exp(-((x - 0.37) ** 2 / 0.013)) +
        0.32 * Math.exp(-((x - 0.69) ** 2 / 0.009));
      const t =
        pattern === 'Hotspot'
          ? Math.min(
              1,
              plume * core +
                0.27 * Math.exp(-((x - 0.7) ** 2 / 0.018 + (y - 0.59) ** 2 / 0.04)),
            )
          : pattern === 'Stripes'
            ? (1 + Math.sin(23 * x + 5 * y)) / 2
            : pattern === 'Noise'
              ? Math.random()
              : 0;
      data[j * nx + i] = min + (max - min) * t;
    }
  return { nx, ny, data };
}
export function resizePlane(plane: Plane, nx: number, ny: number): Plane {
  return {
    nx,
    ny,
    data: Float32Array.from({ length: nx * ny }, (_, k) => {
      const x = Math.floor(((k % nx) * plane.nx) / nx);
      const y = Math.floor((Math.floor(k / nx) * plane.ny) / ny);
      return plane.data[y * plane.nx + x];
    }),
  };
}
const palettes: Record<ColorMap, string[]> = {
  inferno: [
    '100d20',
    '281641',
    '51205f',
    '802c62',
    'ae3853',
    'd9543d',
    'f78040',
    'ffb557',
    'f6eea2',
  ],
  magma: ['090621', '301253', '691c80', 'a33279', 'dd506a', 'fc9468', 'fcfdbf'],
  viridis: ['440154', '3b528b', '21918c', '5ec962', 'fde725'],
  plasma: ['0d0887', '7e03a8', 'cc4778', 'f89540', 'f0f921'],
  cividis: ['00224e', '35456c', '737476', 'b6a570', 'fee838'],
  turbo: [
    '30123b',
    '466be3',
    '28bceb',
    '46f884',
    'b9f735',
    'ff9624',
    'ca2a04',
    '7a0403',
  ],
  coolwarm: ['3b4cc0', '8db0fe', 'dddddd', 'f4987a', 'b40426'],
  gray: ['000000', 'ffffff'],
};
export function gradient(map: ColorMap) {
  return (
    'linear-gradient(to right,' + palettes[map].map((c) => '#' + c).join(',') + ')'
  );
}
const tables = new Map<ColorMap, number[][]>();
export function colorTable(map: ColorMap) {
  let table = tables.get(map);
  if (table) return table;
  const colors = palettes[map].map((hex) =>
    [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16)),
  );
  table = Array.from({ length: 256 }, (_, k) => {
    const pos = (k / 255) * (colors.length - 1),
      a = Math.floor(pos),
      b = Math.min(colors.length - 1, a + 1);
    return colors[a].map((v, c) => Math.round(v + (pos - a) * (colors[b][c] - v)));
  });
  tables.set(map, table);
  return table;
}
export function pixels(
  p: Plane,
  map: ColorMap,
  min: number,
  max: number,
  contours = false,
) {
  const table = colorTable(map),
    out = new Uint8ClampedArray(p.data.length * 4);
  for (let y = 0; y < p.ny; y++)
    for (let x = 0; x < p.nx; x++) {
      const k = (p.ny - 1 - y) * p.nx + x,
        v = p.data[k],
        t = max === min ? 0.5 : (v - min) / (max - min);
      if (!Number.isFinite(t)) continue;
      const rgb = table[Math.max(0, Math.min(255, Math.round(t * 255)))],
        o = (y * p.nx + x) * 4;
      // Blend an isoline at each tenth of the display range.
      const neighbor = k + p.nx < p.data.length ? p.data[k + p.nx] : v;
      const slope = Math.max(
        0.002,
        Math.min(0.024, Math.abs(neighbor - v) / (max - min || 1)),
      );
      const ink =
        contours && t > 0.05
          ? 0.22 * Math.max(0, 1 - Math.abs(t - Math.round(t * 10) / 10) / slope)
          : 0;
      for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * (1 - ink) + 235 * ink;
      out[o + 3] = 255;
    }
  return out;
}
export const numberText = (n: number) => Number(n.toPrecision(5)).toString();
export function encodePlane(data: Float32Array) {
  const bytes = new ArrayBuffer(data.length * 4),
    view = new DataView(bytes);
  data.forEach((n, i) => view.setFloat32(i * 4, n, true));
  return bytes;
}
export function cellAt(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  x: number,
  y: number,
  nx: number,
  ny: number,
) {
  const i = Math.max(
    0,
    Math.min(nx - 1, Math.floor(((x - rect.left) / rect.width) * nx)),
  );
  const j =
    ny -
    1 -
    Math.max(0, Math.min(ny - 1, Math.floor(((y - rect.top) / rect.height) * ny)));
  return { i, j };
}
