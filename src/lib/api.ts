import createClient from 'openapi-fetch';
import type { paths } from './schema';
import type { Plane, ColorMap } from './model';
import { encodePlane } from './model';

export const baseUrl = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
).replace(/\/$/, '');
export const api = createClient<paths>({
  baseUrl,
  fetch: (request) => globalThis.fetch(request),
});
function errorText(error: unknown) {
  if (typeof error === 'object' && error && 'detail' in error) {
    const d = error.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d))
      return d
        .map((item) => [item.loc?.join('.'), item.msg].filter(Boolean).join(' — '))
        .join('\n');
  }
  return '';
}
export function checked<T>(r: { data?: T; error?: unknown; response: Response }): T {
  if (!r.response.ok)
    throw new Error(errorText(r.error) || `Request failed (HTTP ${r.response.status})`);
  return r.data as T;
}
export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
function multipart(body: Record<string, Blob | string | number>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value instanceof Blob) form.append(key, value);
    else form.append(key, String(value));
  }
  return form;
}
export async function saveDrawing(p: Plane) {
  if (p.data.some((v) => !Number.isFinite(v)))
    throw new Error('Every drawn cell must have a finite float32 value.');
  return checked(
    await api.POST('/fields/drawn', {
      body: {
        nx: p.nx,
        ny: p.ny,
        name: 'Drawn field',
        data: new Blob([encodePlane(p.data)], { type: 'application/octet-stream' }),
      },
      bodySerializer: multipart,
    }),
  );
}
export async function upload(file: File) {
  return checked(
    await api.POST('/fields', { body: { file }, bodySerializer: multipart }),
  );
}
export function decodeGrid(buffer: ArrayBuffer, headers: Headers): Plane {
  const nx = Number(headers.get('X-Nx')),
    ny = Number(headers.get('X-Ny'));
  if (
    !Number.isInteger(nx) ||
    nx < 1 ||
    !Number.isInteger(ny) ||
    ny < 1 ||
    nx * ny * 4 !== buffer.byteLength
  )
    throw new Error('Invalid float32 grid dimensions in the API response.');
  const view = new DataView(buffer);
  return {
    nx,
    ny,
    data: Float32Array.from({ length: nx * ny }, (_, i) =>
      view.getFloat32(i * 4, true),
    ),
  };
}
export type Colors = { colormap: ColorMap; vmin?: number; vmax?: number };
export async function frameBlob(
  id: string,
  n: number,
  colors: Colors,
  native = false,
  signal?: AbortSignal,
) {
  return checked(
    await api.GET('/runs/{runId}/frames/{n}.png', {
      params: {
        path: { runId: id, n },
        query: { ...colors, max_side: native ? undefined : 1024 },
      },
      parseAs: 'blob',
      signal,
    }),
  );
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
