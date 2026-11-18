import { expect, it } from 'vitest';
import { examplePlane, exampleConditions, examples } from '@/lib/examples';
import { dtMax } from '@/lib/model';
it.each(examples)(
  'loads a reproducible, stable $name scenario on a small grid',
  (example) => {
    const p = examplePlane(example),
      m = exampleConditions(example, ['dirichlet', 'neumann']);
    expect(p.data).toEqual(examplePlane(example).data);
    expect(p.data.length).toBe(p.nx * p.ny);
    expect(Math.min(...p.data)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...p.data)).toBeGreaterThan(0.5);
    expect(Math.max(...p.data)).toBeLessThanOrEqual(1);
    expect(m.dt).toBeLessThanOrEqual(dtMax(m)!);
    expect(m.frames).toBeGreaterThan(20);
    expect(Object.values(exampleConditions(example, ['dirichlet']).bc!)).toEqual(
      Array(example.nz ? 6 : 4).fill('dirichlet'),
    );
  },
);
it('provides distinct 3D sources with a small solver workload', () => {
  const volumes = examples.filter((e) => e.nz);
  expect(volumes).toHaveLength(2);
  const [plume, ring] = volumes;
  expect(plume.preset).toBe('gaussian_hotspot');
  expect(exampleConditions(plume, ['periodic', 'neumann'])).toMatchObject({
    vz: 0.65,
    bc: { left: 'periodic', right: 'periodic' },
  });
  expect(ring.preset).toBeUndefined();
  expect(ring.intensity(0.5, 0.5, 0)).toBeLessThan(ring.intensity(0.78, 0.5, 0));
  for (const e of volumes) {
    const { nx, ny } = examplePlane(e);
    expect(nx * ny * e.nz! * exampleConditions(e, ['neumann']).steps).toBeLessThan(4e6);
  }
});

it('sets physical units for every example independently of the previous workspace', () => {
  for (const example of examples) {
    const m = exampleConditions(example, ['periodic']);
    expect(m.units).toEqual({ length: 'km', time: 'h' });
    expect(m).toMatchObject({
      vx: example.vx,
      vy: example.vy,
      D: example.D,
      dt: example.dt,
    });
    expect(m).not.toHaveProperty('processes');
  }
});
