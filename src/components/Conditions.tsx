import { useState } from 'react';
import { ArrowUp, Wind } from 'lucide-react';
import {
  dtMax,
  numberText,
  type Conditions as Model,
  type Boundary,
  type Config,
} from '@/lib/model';

const opposite = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
} as const;
const labels: Record<Boundary, string> = {
  dirichlet: 'Fixed (value 0 outside)',
  neumann: 'Insulated (zero gradient)',
  periodic: 'Wrap-around',
};
function NumberField({
  label,
  value,
  update,
  min,
  max,
  integer = false,
  placeholder,
}: {
  label: string;
  value?: number;
  update: (v: number | undefined) => void;
  min?: number;
  max?: number;
  integer?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<{
    raw: string;
    expected: number | undefined;
  } | null>(null);
  return (
    <label>
      {label}
      <input
        type="number"
        step={integer ? 1 : 'any'}
        min={min}
        max={max}
        placeholder={placeholder}
        value={
          draft && draft.expected === value
            ? draft.raw
            : value == null
              ? ''
              : integer
                ? value
                : numberText(value)
        }
        onChange={(e) => {
          const raw = e.target.value,
            n = e.target.valueAsNumber;
          setDraft({ raw, expected: value });
          if (!raw && placeholder) {
            update(undefined);
            return;
          }
          if (Number.isFinite(n) && e.target.validity.valid) {
            update(n);
            setDraft({ raw, expected: n });
          }
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}
export function ConditionsForm({
  model,
  change,
  config,
}: {
  model: Model;
  change: (m: Model) => void;
  config: Config;
}) {
  const limit = dtMax(model),
    [clamped, setClamped] = useState(false);
  function update(next: Model) {
    const max = dtMax(next);
    const clamp = max !== null && next.dt > max;
    setClamped(clamp);
    change(clamp ? { ...next, dt: max } : next);
  }
  function edge(key: keyof typeof opposite, value: Boundary) {
    const pair = opposite[key],
      bc = { ...model.bc, [key]: value };
    if (value === 'periodic' || bc[pair] === 'periodic') bc[pair] = value;
    update({ ...model, bc });
  }
  function field(
    key: 'D' | 'vx' | 'vy' | 'dt' | 'steps' | 'frames' | 'dx' | 'dy' | 'processes',
    label: string,
    min?: number,
    integer = false,
    max?: number,
  ) {
    return (
      <NumberField
        label={label}
        value={model[key]}
        min={min}
        max={max}
        integer={integer}
        placeholder={
          key === 'processes' ? `Auto · ${config.default_processes}` : undefined
        }
        update={(v) => update({ ...model, [key]: v })}
      />
    );
  }
  return (
    <div className="control-stack">
      <div className="input-grid">
        {field('D', 'Diffusion D', 0)}
        {field('dt', 'Time step dt', Number.MIN_VALUE)}
      </div>
      <p className="hint" role="status">
        {clamped ? 'Clamped to stability limit. ' : ''}dt_max ={' '}
        {limit === null ? 'unbounded' : numberText(limit)}
      </p>
      <div className="input-grid">
        {field('vx', 'Velocity vx')}
        {field('vy', 'Velocity vy')}
      </div>
      <div className="wind">
        <Wind size={16} />
        <span>Flow velocity</span>
        <b>{numberText(Math.hypot(model.vx ?? 0, model.vy ?? 0))}</b>
        <ArrowUp
          aria-label="Flow direction"
          size={20}
          style={{
            transform: `rotate(${(Math.atan2(model.vx ?? 0, model.vy ?? 0) * 180) / Math.PI}deg)`,
          }}
        />
      </div>
      <div className="input-grid">
        {field('steps', 'Steps', 1, true, 2147483647)}
        {field('frames', 'Frames to keep', 2, true)}
      </div>
      <div>
        <div className="section-label">Boundary conditions</div>
        <div className="input-grid">
          {(Object.keys(opposite) as (keyof typeof opposite)[]).map((k) => (
            <label key={k} className="capitalize">
              {k} edge
              <select
                value={model.bc?.[k] ?? config.supported_boundary_conditions[0]}
                onChange={(e) => edge(k, e.target.value as Boundary)}
              >
                {config.supported_boundary_conditions.map((b) => (
                  <option key={b} value={b}>
                    {labels[b]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
      <details>
        <summary>Advanced conditions</summary>
        <div className="input-grid">
          {field('dx', 'Grid spacing dx', Number.MIN_VALUE)}
          {field('dy', 'Grid spacing dy', Number.MIN_VALUE)}
          {field('processes', 'MPI processes', 1, true, config.cpu_count)}
        </div>
      </details>
    </div>
  );
}
