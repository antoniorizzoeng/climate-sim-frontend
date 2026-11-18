import type { Field, RequestBody, Run } from '@/lib/model';

export const request: RequestBody = {
  source: { kind: 'preset', preset: 'gaussian_hotspot', nx: 8, ny: 6, nz: 4 },
  dt: 0.25,
  steps: 10,
  frames: 6,
};

export function simulation(overrides: Partial<Run> = {}): Run {
  return {
    id: 'simulation-a',
    status: 'done',
    created_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-01-08T00:00:00Z',
    request,
    resolved: {
      nx: 8,
      ny: 6,
      nz: 4,
      dz: 1,
      dt: 0.25,
      steps: 10,
      out_every: 2,
      expected_frames: 6,
      processes: 1,
      dt_max: null,
      estimated_output_bytes: 1024,
    },
    step: 10,
    time: 2.5,
    queue_position: null,
    message: null,
    frames: 6,
    display_range: [0, 1],
    ...overrides,
  };
}

export const field: Field = {
  id: 'field-a',
  name: 'Measurements',
  source: 'drawn',
  state: 'active',
  created_at: '2026-01-01T00:00:00Z',
  last_used_at: '2026-01-01T00:00:00Z',
  expires_at: '2026-01-08T00:00:00Z',
  size_bytes: 32,
  default_var: 'u',
  variables: [
    {
      name: 'u',
      nx: 2,
      ny: 2,
      nz: 2,
      z_dim: 'level',
      units: 'K',
      extra_dims: [
        { name: 'level', size: 2, values: [0, 1] },
        { name: 'time', size: 365, values: ['Jan 1', 'Jan 2'] },
      ],
    },
    {
      name: 'v',
      nx: 2,
      ny: 2,
      nz: 1,
      extra_dims: [],
    },
  ],
  default_stats: {
    var: 'u',
    index: {},
    nx: 2,
    ny: 2,
    min: 2,
    max: 4,
    mean: 3,
    missing_count: 1,
  },
};
