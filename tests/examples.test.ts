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
      Array(4).fill('dirichlet'),
    );
  },
);
