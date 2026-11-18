import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { it, expect, vi } from 'vitest';
import { FloatType, NearestFilter, LinearFilter, RedFormat } from 'three';
import { decodeVolume } from '@/lib/api';
import { volumeTexture, createVolumeScene } from '@/lib/volumeScene';
import { frameView, initialView, SpatialControls } from '@/components/SpatialControls';
import { frameVolume, projectedFrame, start, validate } from '@/mocks/store';
import type { RequestBody } from '@/lib/model';

const body: RequestBody = {
  steps: 2,
  dt: 0.25,
  source: { kind: 'preset', preset: 'gaussian_hotspot', nx: 8, ny: 6, nz: 4 },
};
const grid = validate(body).resolved!;
it('uses the selected axis length and keeps the export plane when orbiting', () => {
  function Controls() {
    const [view, set] = useState(initialView(grid.nz));
    return (
      <>
        <SpatialControls view={view} change={set} grid={grid} />
        <output>{JSON.stringify(frameView(view))}</output>
      </>
    );
  }
  render(<Controls />);
  expect(screen.getByLabelText('Slice index')).toHaveValue('2');
  fireEvent.change(screen.getByLabelText('Axis'), { target: { value: 'x' } });
  const slice = screen.getByLabelText('Slice index');
  expect(slice).toHaveAttribute('max', '7');
  fireEvent.change(slice, { target: { value: '6' } });
  expect(screen.getByRole('status')).toHaveTextContent('{"axis":"x","slice":6}');
  fireEvent.click(screen.getByRole('button', { name: 'Projection' }));
  fireEvent.change(screen.getByLabelText('Projection method'), {
    target: { value: 'mean' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
  expect(screen.getByRole('status')).toHaveTextContent(
    '{"axis":"x","projection":"mean"}',
  );
});
it('decodes little-endian z/y/x samples and configures an unpack-aligned single-channel texture', () => {
  const buffer = new ArrayBuffer(2 * 3 * 4 * 4);
  const view = new DataView(buffer);
  for (let i = 0; i < 24; i++) view.setFloat32(i * 4, i - 2.25, true);
  const headers = new Headers({ 'X-Nx': '2', 'X-Ny': '3', 'X-Nz': '4' });
  const volume = decodeVolume(buffer, headers);
  expect(volume.data[1 + 2 * (2 + 3 * 3)]).toBe(20.75);
  for (const linear of [false, true]) {
    const gl = { getExtension: vi.fn().mockReturnValue(linear ? {} : null) };
    const texture = volumeTexture(volume, gl);
    expect(gl.getExtension).toHaveBeenCalledWith('OES_texture_float_linear');
    expect(texture.image).toMatchObject({
      width: 2,
      height: 3,
      depth: 4,
      data: volume.data,
    });
    expect(texture).toMatchObject({
      format: RedFormat,
      type: FloatType,
      internalFormat: 'R32F',
      unpackAlignment: 1,
      generateMipmaps: false,
      minFilter: linear ? LinearFilter : NearestFilter,
    });
    texture.dispose();
  }
  expect(() => decodeVolume(buffer.slice(4), headers)).toThrow(/dimensions/);
  headers.delete('X-Nz');
  expect(() => decodeVolume(buffer, headers)).toThrow(/dimensions/);
});
it('handles an unavailable WebGL2 context before texture allocation', () => {
  const context = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
  expect(() => createVolumeScene(document.createElement('div'), [2, 3, 4])).toThrow(
    /WebGL2 is unavailable/,
  );
  expect(context).toHaveBeenCalledWith('webgl2', expect.anything());
  context.mockRestore();
});
it('samples all axes at the same stride and projects the native volume consistently', () => {
  const run = start(body, grid),
    full = frameVolume(run, 0, 128),
    sampled = frameVolume(run, 0, 4);
  expect([sampled.nx, sampled.ny, sampled.nz]).toEqual([4, 3, 2]);
  expect(sampled.data[1 + 4 * (2 + 3)]).toBe(full.data[2 + 8 * (4 + 6 * 2)]);
  for (const axis of ['x', 'y', 'z'] as const) {
    const depth = grid[`n${axis}`];
    const planes = Array.from({ length: depth }, (_, slice) =>
      projectedFrame(run, 0, { axis, slice }),
    );
    const mean = projectedFrame(run, 0, { axis, projection: 'mean' });
    const max = projectedFrame(run, 0, { axis, projection: 'max' });
    for (let i = 0; i < mean.data.length; i++) {
      expect(mean.data[i]).toBeCloseTo(
        planes.reduce((sum, p) => sum + p.data[i], 0) / depth,
      );
      expect(max.data[i]).toBe(Math.max(...planes.map((p) => p.data[i])));
    }
  }
});
