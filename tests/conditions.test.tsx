import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect } from 'vitest';
import { ConditionsForm } from '@/components/Conditions';
import { defaults, dtMax, type Config, type Conditions } from '@/lib/model';
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
