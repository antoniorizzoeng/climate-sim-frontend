import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect } from 'vitest';
import { ConditionsForm } from '@/components/Conditions';
import {
  defaults,
  dtMax,
  clampTimeStep,
  type Config,
  type Conditions,
} from '@/lib/model';
import { config } from '@/mocks/store';
function Form({
  supported = config.supported_boundary_conditions,
}: {
  supported?: Config['supported_boundary_conditions'];
}) {
  const [m, set] = useState<Conditions>({ ...defaults, D: 0, vx: 0, vy: 0, dt: 1 });
  return (
    <ConditionsForm
      model={m}
      change={set}
      config={{ ...config, supported_boundary_conditions: supported }}
    />
  );
}
it('shows unbounded dt for a stationary field and clamps when diffusion changes', () => {
  render(<Form />);
  expect(screen.getByText(/unbounded/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Diffusion D'), { target: { value: '2' } });
  expect(screen.getByLabelText('Time step dt')).toHaveValue(0.125);
  fireEvent.change(screen.getByLabelText('Time step dt'), { target: { value: '10' } });
  expect(screen.getByLabelText('Time step dt')).toHaveValue(0.125);
  expect(screen.getByRole('status')).toHaveTextContent('Clamped');
});
it('uses both spacings and absolute advection speeds', () => {
  expect(dtMax({ ...defaults, vx: -2, vy: 3, dx: 2, dy: 3, D: 0.5 })).toBeCloseTo(
    1 / (2 + 1 / 4 + 1 / 9),
  );
});
it('pairs periodic edges and unpairs them together', () => {
  render(<Form />);
  expect(screen.getByLabelText('left edge')).toHaveAccessibleDescription(
    'Wrap-around applies to both opposite edges. Selecting or removing it updates both edges.',
  );
  fireEvent.change(screen.getByLabelText('left edge'), {
    target: { value: 'periodic' },
  });
  expect(screen.getByLabelText('right edge')).toHaveValue('periodic');
  fireEvent.change(screen.getByLabelText('right edge'), {
    target: { value: 'neumann' },
  });
  expect(screen.getByLabelText('left edge')).toHaveValue('neumann');
  expect(screen.getByLabelText('top edge')).toHaveValue('dirichlet');
  fireEvent.change(screen.getByLabelText('bottom edge'), {
    target: { value: 'periodic' },
  });
  expect(screen.getByLabelText('top edge')).toHaveValue('periodic');
  expect(screen.getByLabelText('right edge')).toHaveValue('neumann');
});
it('offers only boundary conditions reported by the engine', () => {
  render(<Form supported={['neumann']} />);
  expect(screen.queryByRole('option', { name: 'Wrap-around' })).toBeNull();
  expect(screen.queryByText(/Wrap-around applies/)).toBeNull();
  expect(screen.getAllByRole('option')).toHaveLength(4);
});

it('uses vertical spacing, velocity and anisotropic diffusion only for multiple layers', () => {
  const m = {
    ...defaults,
    nz: 8,
    dx: 2,
    dy: 4,
    dz: 0.5,
    D: 0.25,
    vx: -2,
    vy: 4,
    vz: -0.5,
  };
  expect(dtMax({ ...m, Dz: 0.125 })).toBeCloseTo(
    1 / (3 + 2 * (0.25 / 4 + 0.25 / 16 + 0.125 / 0.25)),
  );
  expect(dtMax(m)).toBeCloseTo(1 / (3 + 2 * (0.25 / 4 + 0.25 / 16 + 0.25 / 0.25)));
  expect(dtMax({ ...m, nz: 1 })).toBeCloseTo(1 / (2 + 2 * (0.25 / 4 + 0.25 / 16)));
});

it('pairs depth faces, clamps vertical flow and removes depth fields on returning to 2D', () => {
  let model: Conditions = { ...defaults, D: 0, vx: 0, vy: 0, dt: 1 };
  function Harness() {
    const [m, set] = useState(model);
    return (
      <ConditionsForm
        config={config}
        model={m}
        change={(next) => {
          model = next;
          set(next);
        }}
      />
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '3D' }));
  fireEvent.change(screen.getByLabelText('front edge'), {
    target: { value: 'periodic' },
  });
  expect(screen.getByLabelText('back edge')).toHaveValue('periodic');
  fireEvent.change(screen.getByLabelText('back edge'), {
    target: { value: 'neumann' },
  });
  expect(screen.getByLabelText('front edge')).toHaveValue('neumann');
  fireEvent.change(screen.getByLabelText('Vertical flow'), { target: { value: '-2' } });
  expect(screen.getByLabelText('Velocity vz')).toHaveValue(-2);
  expect(model.dt).toBeCloseTo(0.5);
  fireEvent.change(screen.getByLabelText('Vertical diffusion Dz'), {
    target: { value: '2' },
  });
  expect(model.dt).toBeCloseTo(1 / 6);
  fireEvent.click(screen.getByRole('button', { name: '2D' }));
  for (const key of ['nz', 'vz', 'dz', 'Dz']) expect(model).not.toHaveProperty(key);
  expect(model.bc).not.toHaveProperty('front');
  expect(model.bc).not.toHaveProperty('back');
  expect(screen.queryByLabelText('Layers nz')).toBeNull();
});

it('keeps clamped volume timesteps inside the high-precision API limit', () => {
  const m = { ...defaults, nz: 8, dz: 0.7, vz: 0.1, dt: 1 };
  const backendLimit = 0.5436591589925662;
  expect(dtMax(m)).toBeCloseTo(backendLimit, 15);
  expect(clampTimeStep(m).dt).toBeLessThanOrEqual(backendLimit);
});
