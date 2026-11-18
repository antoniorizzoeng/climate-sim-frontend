import { api, checked, decodeGrid } from './api';
import type { Conditions, Field, Plane, PlaneSelection, Volume } from './model';

const maxSide = 96;
const maxLayers = 48;
type Variable = Field['variables'][number];

export function sourceLayer(variable: Variable, z: number) {
  const values = variable.extra_dims.find((d) => d.name === variable.z_dim)?.values;
  const first = values?.[0],
    last = values?.at(-1);
  return typeof first === 'number' && typeof last === 'number' && first > last
    ? variable.nz - 1 - z
    : z;
}

// The volume preset uses a cell-centred Gaussian with a width of 5% of the shortest side.
export function gaussianSlice(
  nx: number,
  ny: number,
  model: Conditions,
  z: number,
): Plane {
  const { dx = 1, dy = 1, dz = 1, nz = 1 } = model;
  const sigma = 0.05 * Math.min(nx * dx, ny * dy, nz * dz);
  const height = ((z + 0.5 - nz / 2) * dz) / sigma;
  const data = Float32Array.from({ length: nx * ny }, (_, i) => {
    const x = (((i % nx) + 0.5 - nx / 2) * dx) / sigma;
    const y = ((Math.floor(i / nx) + 0.5 - ny / 2) * dy) / sigma;
    return Math.exp(-0.5 * (x * x + y * y + height * height));
  });
  return { nx, ny, data };
}

function sampledZ(i: number, count: number, layers: number) {
  return count === 1 ? 0 : Math.round((i * (layers - 1)) / (count - 1));
}

export function drawingVolume(
  plane: Plane,
  model: Conditions,
  gaussian = false,
): Volume {
  const layers = model.nz ?? 1;
  const stride = Math.max(1, Math.ceil(Math.max(plane.nx, plane.ny) / maxSide));
  const nx = Math.ceil(plane.nx / stride),
    ny = Math.ceil(plane.ny / stride);
  const nz = Math.min(layers, maxLayers);
  const data = new Float32Array(nx * ny * nz);
  for (let k = 0; k < (gaussian ? nz : 1); k++) {
    const p = gaussian
      ? gaussianSlice(plane.nx, plane.ny, model, sampledZ(k, nz, layers))
      : plane;
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        data[(k * ny + y) * nx + x] = p.data[(y * plane.nx + x) * stride];
  }
  if (!gaussian) for (let k = 1; k < nz; k++) data.copyWithin(k * nx * ny, 0, nx * ny);
  return { nx, ny, nz, data };
}

async function readLayer(
  selection: PlaneSelection,
  z: Record<string, number>,
  window: {
    stride?: number;
    i0?: number;
    j0?: number;
    w?: number;
    h?: number;
  },
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const result = await api.GET('/fields/{fieldId}/values', {
    params: {
      path: { fieldId: selection.field.id },
      query: {
        var: selection.variable,
        index: { ...selection.index, ...z },
        ...window,
      },
    },
    parseAs: 'arrayBuffer',
    signal,
  });
  return decodeGrid(checked(result), result.response.headers);
}

export async function uploadedVolume(
  selection: PlaneSelection,
  variable: Variable,
  layers: number,
  signal: AbortSignal,
): Promise<Volume> {
  const stride = Math.max(1, Math.ceil(Math.max(variable.nx, variable.ny) / maxSide));
  const nx = Math.ceil(variable.nx / stride),
    ny = Math.ceil(variable.ny / stride);
  const nz = Math.min(layers, maxLayers);
  const data = new Float32Array(nx * ny * nz);
  const zDim = selection.volume && variable.z_dim;
  for (let k = 0; k < nz; k++) {
    if (!zDim && k > 0) {
      data.copyWithin(k * nx * ny, 0, nx * ny);
      continue;
    }
    const index = zDim
      ? { [zDim]: sourceLayer(variable, sampledZ(k, nz, layers)) }
      : {};
    const p = await readLayer(selection, index, { stride }, signal);
    if (p.nx !== nx || p.ny !== ny)
      throw new Error('Unexpected sampled field dimensions.');
    data.set(p.data, k * nx * ny);
  }
  return { nx, ny, nz, data };
}

// An identical downsample cannot prove that the original layers match. Compare
// native windows and stop at the first difference, keeping just two tiles in memory.
export async function sameLayers(
  selection: PlaneSelection,
  variable: Variable,
  signal: AbortSignal,
) {
  if (!variable.z_dim) return true;
  for (let y = 0; y < variable.ny; y += 256)
    for (let x = 0; x < variable.nx; x += 256) {
      const window = {
        i0: x,
        j0: y,
        w: Math.min(256, variable.nx - x),
        h: Math.min(256, variable.ny - y),
      };
      const first = await readLayer(selection, { [variable.z_dim]: 0 }, window, signal);
      for (let k = 1; k < variable.nz; k++) {
        const other = await readLayer(
          selection,
          { [variable.z_dim]: k },
          window,
          signal,
        );
        if (
          other.data.some(
            (v, i) =>
              v !== first.data[i] && !(Number.isNaN(v) && Number.isNaN(first.data[i])),
          )
        )
          return false;
      }
    }
  return true;
}
