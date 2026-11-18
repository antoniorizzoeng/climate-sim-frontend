import { Activity, Moon, Telescope } from 'lucide-react';
import {
  bestWindow,
  clockTime,
  layerNames,
  localStamp,
  seeingHours,
  type Nowcast,
  type SiteSample,
} from '@/lib/sky';

export function SeeingStrip({ site }: { site: SiteSample[] }) {
  return (
    <div className="seeing-strip" role="group" aria-label="Hourly seeing">
      {seeingHours(site).map((s) => {
        const wind = `250 hPa wind · ${s.jet_ms.toFixed(1)} m/s`;
        return (
          <span
            key={s.time}
            role="img"
            className={'seeing-chip ' + s.seeing}
            tabIndex={0}
            aria-label={localStamp(s.time) + ', ' + s.seeing + ', ' + wind}
          >
            <time dateTime={s.time}>{clockTime(s.time)}</time>
            <b>{s.seeing}</b>
            <span className="wind-tip" aria-hidden="true">
              {wind}
            </span>
          </span>
        );
      })}
    </div>
  );
}

const percent = (v: number) => Math.round(100 * v) + '%';
export function SkyChart({ record }: { record?: Nowcast }) {
  const site = record?.site;
  const window = site && bestWindow(site);
  const label = 'Tonight at a glance';
  if (!record || !site?.length)
    return (
      <section className="panel">
        <header className="panel-head">
          <h2>
            <Activity size={17} />
            {label}
          </h2>
        </header>
        <div className="sky-empty">
          <Telescope size={36} strokeWidth={1.25} />
          <p>
            {!record
              ? 'Run a nowcast or open a recent one to see the observing window.'
              : record.status === 'error'
                ? 'No site forecast is available for this run.'
                : 'Waiting for all three cloud layers.'}
          </p>
        </div>
      </section>
    );
  const last = site.length - 1;
  const x = (i: number) => (1000 * i) / Math.max(1, last);
  const points = (value: (s: SiteSample) => number) =>
    site.map((s, i) => x(i) + ',' + (100 - 100 * value(s))).join(' ');
  const ticks = Array.from(
    new Set([0, Math.round(last / 3), Math.round((2 * last) / 3), last]),
  );
  return (
    <section className="panel sky-chart" aria-label={label}>
      <header className="panel-head">
        <h2>
          <Activity size={17} />
          {label}
        </h2>
        <span className="micro">LOCAL TIME</span>
      </header>
      <div className="sky-body">
        <p className="chart-site">
          {record.params.lat.toFixed(3)}°, {record.params.lon.toFixed(3)}° ·{' '}
          {localStamp(site[0].time)}
        </p>
        <div className="best-window">
          <Moon size={23} />
          <div>
            <span>Best observing window</span>
            <strong>
              {window
                ? clockTime(site[window.start].time) +
                  ' – ' +
                  clockTime(site[window.end].time)
                : 'No qualifying stretch'}
            </strong>
            <small>At least 70% clear with good or fair seeing</small>
          </div>
        </div>
        <div className="sky-plot-head">
          <h3>Clear sky</h3>
          <div className="line-legend">
            <span>Nowcast (wind transport)</span>
            <span>Model forecast (Open-Meteo)</span>
          </div>
        </div>
        <div className="clear-plot">
          <div className="clear-axis">
            {[100, 75, 50, 25, 0].map((v) => (
              <span key={v}>{v}%</span>
            ))}
          </div>
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="Clear-sky percentage over time. Sample values are in the table below."
          >
            {window && (
              <rect
                x={x(window.start)}
                width={x(window.end) - x(window.start)}
                height="100"
                fill="#8ac8a720"
              />
            )}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                x2="1000"
                y1={y}
                y2={y}
                stroke="#42434c"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {window &&
              [window.start, window.end].map((i) => (
                <line
                  key={i}
                  x1={x(i)}
                  x2={x(i)}
                  y1="0"
                  y2="100"
                  stroke="#9ccbaf"
                  strokeDasharray="2 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            <polyline
              points={points((s) => s.nowcast.clear)}
              fill="none"
              stroke="#ffad86"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={points((s) => s.model.clear)}
              fill="none"
              stroke="#8bcde9"
              strokeDasharray="6 4"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="sky-ticks">
          {ticks.map((i) => (
            <span key={i}>{clockTime(site[i].time)}</span>
          ))}
        </div>
        <div className="sky-plot-head">
          <h3>Nowcast cloud cover</h3>
          <small>0–100% per layer</small>
        </div>
        <div className="cover-bands">
          {layerNames.map((layer, i) => (
            <div key={layer}>
              <span>{layer}</span>
              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon
                  points={'0,100 ' + points((s) => s.nowcast[layer]) + ' 1000,100'}
                  fill={['#8bbdc7', '#b0a6d8', '#dab493'][i]}
                />
              </svg>
            </div>
          ))}
        </div>
        <div className="sky-plot-head">
          <h3>Hourly seeing</h3>
          <small>250 hPa jet stream</small>
        </div>
        <SeeingStrip site={site} />
        <details className="sky-values">
          <summary>
            Ten-minute site samples · {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </summary>
          <div
            className="sky-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Ten-minute site samples"
          >
            <table>
              <caption>Clear sky and nowcast layer cover, in percent</caption>
              <thead>
                <tr>
                  {[
                    'Local time',
                    'Nowcast clear',
                    'Model clear',
                    'Low',
                    'Mid',
                    'High',
                    'Seeing',
                    'Wind (m/s)',
                  ].map((h) => (
                    <th scope="col" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {site.map((s) => (
                  <tr key={s.time}>
                    <th scope="row">{localStamp(s.time)}</th>
                    <td>{percent(s.nowcast.clear)}</td>
                    <td>{percent(s.model.clear)}</td>
                    {layerNames.map((l) => (
                      <td key={l}>{percent(s.nowcast[l])}</td>
                    ))}
                    <td>{s.seeing}</td>
                    <td>{s.jet_ms.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
