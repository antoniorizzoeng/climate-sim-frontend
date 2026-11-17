import type { Plane } from '@/lib/model';
// Average the area covered by each output pixel, ignoring masked cells.
export function downsample(p: Plane, maxSide?: number): Plane {
  if (!maxSide || Math.max(p.nx, p.ny) <= maxSide) return p;
  const scale = maxSide / Math.max(p.nx, p.ny),
    nx = Math.max(1, Math.round(p.nx * scale)),
    ny = Math.max(1, Math.round(p.ny * scale));
  const data = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const left = (i * p.nx) / nx,
        right = ((i + 1) * p.nx) / nx,
        bottom = (j * p.ny) / ny,
        top = ((j + 1) * p.ny) / ny;
      let sum = 0,
        area = 0;
      for (let y = Math.floor(bottom); y < Math.ceil(top); y++)
        for (let x = Math.floor(left); x < Math.ceil(right); x++) {
          const value = p.data[y * p.nx + x];
          if (!Number.isFinite(value)) continue;
          const weight =
            (Math.min(x + 1, right) - Math.max(x, left)) *
            (Math.min(y + 1, top) - Math.max(y, bottom));
          area += weight;
          sum += weight * value;
        }
      data[j * nx + i] = area ? sum / area : NaN;
    }
  return { nx, ny, data };
}
