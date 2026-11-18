import { useCallback, useState } from 'react';
import { Layers } from 'lucide-react';
import { Player } from '@/components/Player';
import { Timeline } from '@/components/Timeline';
import { gradient, type Run } from '@/lib/model';
import { clockTime, layerNames, type Nowcast } from '@/lib/sky';

const colors = { colormap: 'cividis' } as const;
const range = [0, 1];
const ignoreReadout = () => {};

function Movie({
  name,
  pressure,
  run,
  n,
  present,
}: {
  name: string;
  pressure: number;
  run: Run;
  n: number;
  present: (id: string, n: number) => void;
}) {
  const onPresent = useCallback(
    (index: number) => present(run.id, index),
    [present, run.id],
  );
  return (
    <div className="sky-movie">
      <h3>
        <span>{name} cloud</span>
        <small>{pressure} hPa</small>
      </h3>
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
    </div>
  );
}
export function LayerMovies({ record, runs }: { record: Nowcast; runs: Run[] }) {
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
      </header>
      <div className="sky-body">
        <div className="sky-movies">
          {layerNames.map((name) => {
            const layer = record.layers.find((l) => l.layer === name);
            const run = runs.find((r) => r.id === layer?.run_id);
            return (
              layer &&
              run && (
                <Movie
                  key={run.id}
                  name={name}
                  pressure={layer.pressure_hpa}
                  run={run}
                  n={n}
                  present={present}
                />
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
              style={{ background: gradient(colors.colormap) }}
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
