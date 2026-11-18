import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { numberText, type Run } from '@/lib/model';
import { Output } from '@/components/Output';
import { config } from '@/mocks/store';

it('uses significant digits for large, small and near-zero quantities', () => {
  expect(numberText(0.9164118767867846)).toBe('0.91641');
  expect(numberText(-0.00000000012345678)).toBe('-1.2346e-10');
  expect(numberText(1234567.123)).toBe('1234600');
  expect(numberText(-0)).toBe('0');
});
it('preserves the exact untouched range endpoint and the precision of typed edits', () => {
  const change = vi.fn(),
    max = 0.9164118767867846;
  render(
    <Output
      run={{ display_range: [0, max] } as Run}
      n={0}
      colors={{ colormap: 'inferno' }}
      change={change}
      config={config}
    />,
  );
  const min = screen.getByLabelText('Range minimum'),
    upper = screen.getByLabelText('Range maximum');
  expect(upper).toHaveValue(0.91641);
  fireEvent.focus(upper);
  fireEvent.blur(upper);
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(min, { target: { value: '0.123456789' } });
  expect(min).toHaveValue(0.123456789);
  expect(change).toHaveBeenLastCalledWith({
    colormap: 'inferno',
    vmin: 0.123456789,
    vmax: max,
  });
  fireEvent.blur(min);
  expect(min).toHaveValue(0.12346);
});

it.each([[null], [[0.000001234567, 0.000001234567]]])(
  'shows invalid edited ranges even when the reported range is missing or constant (%j)',
  (displayRange) => {
    const change = vi.fn();
    render(
      <Output
        run={{ display_range: displayRange } as Run}
        n={0}
        colors={{ colormap: 'inferno' }}
        change={change}
        config={config}
      />,
    );
    expect(screen.queryByText(/Enter a minimum/)).not.toBeInTheDocument();
    const minimum = screen.getByLabelText('Range minimum');
    fireEvent.change(minimum, { target: { value: '2' } });
    expect(screen.getByText('Enter a minimum below the maximum.')).toBeVisible();
    expect(change).not.toHaveBeenCalled();
    fireEvent.blur(minimum);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to run range' }));
    expect(screen.queryByText(/Enter a minimum/)).not.toBeInTheDocument();
    expect(minimum).toHaveValue(displayRange ? 0.0000012346 : 0);
  },
);
