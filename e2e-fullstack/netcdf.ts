const NC_DIMENSION = 10;
const NC_VARIABLE = 11;
const NC_ATTRIBUTE = 12;
const NC_FLOAT = 5;

export const nx = 8;
export const ny = 6;
export const missingCell = 2 * nx + 3;

function words(...values: number[]) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => bytes.writeUInt32BE(value, i * 4));
  return bytes;
}

function name(value: string) {
  const bytes = Buffer.from(value, 'ascii');
  return Buffer.concat([
    words(bytes.length),
    bytes,
    Buffer.alloc((4 - (bytes.length % 4)) % 4),
  ]);
}

function floats(values: number[]) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => bytes.writeFloatBE(value, i * 4));
  return bytes;
}

export function classicNetCDF() {
  const fillValue = -9999;
  const time = floats([0, 6]);
  const first = Array<number>(nx * ny).fill(250);
  const second = Array<number>(nx * ny).fill(280);
  second[missingCell] = fillValue;
  const temperature = floats([...first, ...second]);

  // CDF-1 uses big-endian headers and data with four-byte alignment.
  // All dimensions are fixed. The variable header ends with its byte size and offset.
  const header = (dataStart: number) =>
    Buffer.concat([
      Buffer.from([0x43, 0x44, 0x46, 1]),
      words(0, NC_DIMENSION, 3), // Record count, followed by dimensions.
      name('time'),
      words(2),
      name('y'),
      words(ny),
      name('x'),
      words(nx),
      words(0, 0, NC_VARIABLE, 2), // No global attributes, two variables.
      name('time'),
      words(1, 0, 0, 0, NC_FLOAT, time.length, dataStart),
      name('temperature'),
      words(3, 0, 1, 2, NC_ATTRIBUTE, 1),
      name('_FillValue'),
      words(NC_FLOAT, 1),
      floats([fillValue]),
      words(NC_FLOAT, temperature.length, dataStart + time.length),
    ]);
  return Buffer.concat([header(header(0).length), time, temperature]);
}
