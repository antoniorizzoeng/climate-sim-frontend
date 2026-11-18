import { useId, useState } from 'react';
import { ArrowUp, Wind } from 'lucide-react';
import {
  dtMax,
  changeUnits,
  systems,
  clampTimeStep,
  withLayers,
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
  front: 'back',
  back: 'front',
} as const;
const labels: Record<Boundary, string> = {
  dirichlet: 'Fixed (value 0 outside)',
  neumann: 'Insulated (zero gradient)',
  periodic: 'Wrap-around',
};
export function NumberField({
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
  volumeLayers,
  onDimensionChange,
  approximate,
  gridEstimate,
}: {
  model: Model;
  change: (m: Model) => void;
  config: Config;
  volumeLayers?: number;
  approximate?: boolean;
  gridEstimate?: React.ReactNode;
  onDimensionChange?: (three: boolean) => void;
}) {
  const limit = dtMax(model),
    [clamped, setClamped] = useState(false);
  const [convert, setConvert] = useState(false);
  const units = model.units ?? systems.km;
  const speed = units.length + '/' + units.time;
  const diffusion = units.length + '²/' + units.time;
  const boundaryHint = useId();
  const supportsWrap = config.supported_boundary_conditions.includes('periodic');
  function update(next: Model) {
    const stable = clampTimeStep(next);
    setClamped(stable.dt < next.dt || (next.nz !== model.nz && next.dt < model.dt));
    change(stable);
  }
  function edge(key: keyof typeof opposite, value: Boundary) {
    const pair = opposite[key],
      bc = { ...model.bc, [key]: value };
    if (value === 'periodic' || bc[pair] === 'periodic') bc[pair] = value;
    update({ ...model, bc });
  }
  function field(
    key:
      'dz' | 'Dz' | 'vz' | 'D' | 'vx' | 'vy' | 'dt' | 'steps' | 'frames' | 'dx' | 'dy',
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
        placeholder={key === 'Dz' ? `Use D · ${model.D ?? 0}` : undefined}
        update={(v) => update({ ...model, [key]: v })}
      />
    );
  }
  return (
    <div className="control-stack">
      <label>
        Unit system
        <select
          value={units.length}
          onChange={(e) =>
            change(
              changeUnits(
                model,
                systems[e.target.value as keyof typeof systems],
                convert,
              ),
            )
          }
        >
          <option value="km">Kilometres + hours</option>
          <option value="m">Metres + seconds</option>
          <option value="cell">Grid units</option>
        </select>
      </label>
      <label className="convert-units">
        <input
          type="checkbox"
          checked={convert && units.length !== 'cell'}
          disabled={units.length === 'cell'}
          onChange={(e) => setConvert(e.target.checked)}
        />
        Convert values between physical units
      </label>
      {units.length === 'cell' && (
        <p className="hint">
          Grid units have no physical scale. Switching keeps the numeric values.
        </p>
      )}
      <div className="segmented" role="group" aria-label="Simulation dimensions">
        {[false, true].map((three) => (
          <button
            key={String(three)}
            aria-pressed={!!model.nz === three}
            onClick={() =>
              onDimensionChange
                ? onDimensionChange(three)
                : update(withLayers(model, three ? (model.nz ?? 16) : 1))
            }
          >
            {three ? '3D' : '2D'}
          </button>
        ))}
      </div>
      {model.nz && (
        <div className="input-grid">
          {volumeLayers ? (
            <label>
              Layers nz
              <input readOnly type="number" value={volumeLayers} />
            </label>
          ) : (
            <NumberField
              label="Layers nz"
              value={model.nz}
              min={2}
              integer
              update={(v) => update(withLayers(model, v!))}
            />
          )}
          {field('Dz', `Vertical diffusion Dz (${diffusion})`, 0)}
          {field('vz', `Velocity vz (${speed})`)}
        </div>
      )}
      <div className="input-grid">
        {field('dx', `Grid spacing dx (${units.length})`, Number.MIN_VALUE)}
        {field('dy', `Grid spacing dy (${units.length})`, Number.MIN_VALUE)}
        {model.nz && field('dz', `Grid spacing dz (${units.length})`, Number.MIN_VALUE)}
      </div>
      {approximate && (
        <p className="hint">Uploaded coordinate spacing is approximate.</p>
      )}
      {gridEstimate}
      <div className="input-grid">
        {field('D', `Diffusion D (${diffusion})`, 0)}
        {field('dt', `Time step dt (${units.time})`, Number.MIN_VALUE)}
      </div>
      <p className="hint" role="status">
        {clamped ? 'Clamped to stability limit. ' : ''}dt_max ={' '}
        {limit === null ? 'unbounded' : `${numberText(limit)} ${units.time}`}
      </p>
      <div className="input-grid">
        {field('vx', `Velocity vx (${speed})`)}
        {field('vy', `Velocity vy (${speed})`)}
      </div>
      <div className="wind">
        <Wind size={16} />
        <span>Flow velocity</span>
        <b>
          {numberText(Math.hypot(model.vx ?? 0, model.vy ?? 0, model.vz ?? 0))} {speed}
        </b>
        <ArrowUp
          aria-label="Flow direction"
          size={20}
          style={{
            transform: `rotate(${(Math.atan2(model.vx ?? 0, model.vy ?? 0) * 180) / Math.PI}deg)`,
          }}
        />
        {model.nz && (
          <label className="vertical-flow">
            Vertical flow ({speed})
            <input
              type="range"
              aria-label="Vertical flow"
              aria-valuetext={`${numberText(model.vz ?? 0)} ${speed}`}
              min={-Math.max(2, Math.abs(model.vz ?? 0))}
              max={Math.max(2, Math.abs(model.vz ?? 0))}
              step={0.05}
              value={model.vz ?? 0}
              onChange={(e) => update({ ...model, vz: +e.target.value })}
            />
          </label>
        )}
      </div>
      <div className="input-grid">
        {field('steps', 'Steps', 1, true, 2147483647)}
        {field('frames', 'Frames to keep', 2, true)}
      </div>
      <div>
        <div className="section-label">Boundary conditions</div>
        <div className="input-grid">
          {(Object.keys(opposite) as (keyof typeof opposite)[])
            .filter((k) => model.nz || (k !== 'front' && k !== 'back'))
            .map((k) => (
              <label key={k} className="capitalize">
                {k} edge
                <select
                  value={model.bc?.[k] ?? config.supported_boundary_conditions[0]}
                  onChange={(e) => edge(k, e.target.value as Boundary)}
                  aria-describedby={supportsWrap ? boundaryHint : undefined}
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
        {supportsWrap && (
          <p className="hint" id={boundaryHint}>
            Wrap-around applies to both opposite edges. Selecting or removing it updates
            both edges.
          </p>
        )}
      </div>
    </div>
  );
}
