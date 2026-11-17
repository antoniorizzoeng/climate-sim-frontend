// CDF-5 with fixed dimensions and one big-endian NC_DOUBLE variable named u.
import type { Plane } from '@/lib/model';
export function netcdf(
  nx: number,
  ny: number,
  getPlane: (i: number) => Plane,
  frames?: number,
) {
  const dims: [string, number][] =
    frames === undefined
      ? [
          ['y', ny],
          ['x', nx],
        ]
      : [
          ['time', frames],
          ['y', ny],
          ['x', nx],
        ];
  const words: number[] = [0x43444605, 0, 0, 10, 0, dims.length];
  function name(value: string) {
    words.push(0, value.length);
    for (let k = 0; k < value.length; k += 4) {
      let w = 0;
      for (let j = 0; j < 4; j++) w = w * 256 + (value.charCodeAt(k + j) || 0);
      words.push(w);
    }
  }
  for (const [key, size] of dims) {
    name(key);
    words.push(0, size);
  }
  words.push(0, 0, 0, 11, 0, 1);
  name('u');
  words.push(0, dims.length);
  dims.forEach((_, i) => words.push(0, i));
  const size = nx * ny * (frames ?? 1) * 8;
  words.push(
    0,
    0,
    0,
    6,
    Math.floor(size / 2 ** 32),
    size >>> 0,
    0,
    (words.length + 8) * 4,
  );
  const header = new ArrayBuffer(words.length * 4),
    view = new DataView(header);
  words.forEach((w, i) => view.setUint32(i * 4, w));
  const chunks: BlobPart[] = [header];
  for (let k = 0; k < (frames ?? 1); k++) {
    const p = getPlane(k),
      data = new ArrayBuffer(nx * ny * 8),
      dv = new DataView(data);
    p.data.forEach((v, i) => dv.setFloat64(8 * i, v));
    chunks.push(data);
  }
  return new Blob(chunks, { type: 'application/x-netcdf' });
}
