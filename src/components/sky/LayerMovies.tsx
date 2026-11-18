import { lazy, Suspense, useCallback, useState } from 'react';
import { Layers } from 'lucide-react';
import { Player } from '@/components/Player';
import { Timeline } from '@/components/Timeline';
import { gradient, type Run } from '@/lib/model';
import { clockTime, layerNames, type Nowcast } from '@/lib/sky';
import { LayerWeightTag, mostlyBelow } from './ObserverCloud';

import type { Map as LibreMap } from 'maplibre-gl';
const CloudMap = lazy(() => import('./CloudMap'));
const colors = { colormap: 'cividis' } as const;
const range = [0, 1];
const ignoreReadout = () => {};

function Movie({
  name,
  run,
  n,
  present,
}: {
  name: string;
  run: Run;
  n: number;
  present: (id: string, n: number) => void;
}) {
  const onPresent = useCallback(
    (index: number) => present(run.id, index),
    [present, run.id],
  );
  return (
    <Player
      run={run}
      n={n}
      colors={colors}
      range={range}
      onPresent={onPresent}
      onRead={ignoreReadout}
      readout=""
      layerLabel={name}
    />
  );
}
export function LayerMovies({
  record,
  runs,
  mapKey = '',
}: {
  record: Nowcast;
  runs: Run[];
  mapKey?: string;
}) {
  const [peers] = useState(() => new Set<LibreMap>());
  const [plain, setPlain] = useState(false);
  const mapped = !!mapKey && !plain;
  const [n, setN] = useState(0),
    [presented, setPresented] = useState<Record<string, number>>({});
  const present = useCallback(
    (id: string, index: number) =>
      setPresented((old) => (old[id] === index ? old : { ...old, [id]: index })),
    [],
  );
  if (!record.site?.length || runs.length !== 3) return null;
  const frames = Math.min(record.site.length, ...runs.map((r) => r.frames));
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>
          <Layers size={17} />
          Layer movies
        </h2>
        {mapKey && (
          <button
            className="secondary"
            onClick={() => {
              setPlain(!plain);
              setPresented({});
            }}
          >
            {mapped ? 'Show cloud frames' : 'Show terrain maps'}
          </button>
        )}
      </header>
      <div className="sky-body">
        <div className={mapped ? 'sky-movies mapped-movies' : 'sky-movies'}>
          {layerNames.map((name) => {
            const layer = record.layers.find((l) => l.layer === name);
            const run = runs.find((r) => r.id === layer?.run_id);
            const weight = record.site_elevation?.layer_weights[name];
            return (
              layer &&
              run && (
                <div
                  key={run.id}
                  className={mostlyBelow(weight) ? 'sky-movie below-site' : 'sky-movie'}
                >
                  <h3>
                    <span>{name} cloud</span>
                    <small>{layer.pressure_hpa} hPa</small>
                    <LayerWeightTag weight={weight} />
                  </h3>
                  {mapped ? (
                    <Suspense fallback={<p>Loading terrain…</p>}>
                      <CloudMap
                        mapKey={mapKey}
                        grid={record.grid}
                        lat={record.params.lat}
                        lon={record.params.lon}
                        peers={peers}
                        runId={run.id}
                        n={n}
                        present={present}
                      />
                    </Suspense>
                  ) : (
                    <Movie name={name} run={run} n={n} present={present} />
                  )}
                </div>
              )
            );
          })}
        </div>
        <div className="movie-key">
          <span>
            <i className="key-marker" /> Observing site
          </span>
          <span>
            0%{' '}
            <i
              className="cloud-ramp"
              style={{
                background: mapped
                  ? 'linear-gradient(to right, transparent, #fafafa)'
                  : gradient(colors.colormap),
              }}
            />{' '}
            100% cover
          </span>
        </div>
        <Timeline
          run={{ ...runs[0], frames }}
          n={n}
          setN={setN}
          clocks={record.site.map((s) => clockTime(s.time))}
          ready={runs.every((r) => presented[r.id] === n)}
        />
      </div>
    </section>
  );
}
