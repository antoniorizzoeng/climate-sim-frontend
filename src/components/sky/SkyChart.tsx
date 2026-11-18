import { Activity, Moon, Telescope } from 'lucide-react';
import {
  bestWindow,
  clockTime,
  defaultBlendTauHours,
  layerNames,
  localStamp,
  seeingHours,
  type Nowcast,
  type SiteSample,
} from '@/lib/sky';

type SeeingSample = Pick<SiteSample, 'time' | 'jet_ms' | 'seeing'>;

export function SeeingStrip({ site }: { site: SeeingSample[] }) {
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
// Older backends and saved forecasts can omit these fields.
type ChartSample = Omit<SiteSample, 'blend'> & Partial<Pick<SiteSample, 'blend'>>;
type ChartRecord = Omit<Nowcast, 'site' | 'best_window'> & {
  site: ChartSample[] | null;
  best_window?: Nowcast['best_window'];
};

export function SkyChart({ record }: { record?: ChartRecord }) {
  const site = record?.site;
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
  const legacyWindow = record.best_window === undefined ? bestWindow(site) : undefined;
  const window =
    record.best_window ??
    (legacyWindow && {
      start: site[legacyWindow.start].time,
      end: site[legacyWindow.end].time,
    });
  const sampleIndex = (iso: string) =>
    site.findIndex((sample) => Date.parse(sample.time) === Date.parse(iso));
  const startIndex = window ? sampleIndex(window.start) : -1;
  const endIndex = window ? sampleIndex(window.end) : -1;
  const windowEdges =
    startIndex < 0 || endIndex < 0 ? [] : [...new Set([startIndex, endIndex])];
  const hasBlend = site.every((sample) => sample.blend);
  const cover = (sample: ChartSample) =>
    (hasBlend ? sample.blend : undefined) ?? sample.nowcast;
  const coverLabel = hasBlend ? 'Blended cloud cover' : 'Nowcast cloud cover';
  const tau = record.params.blend_tau_hours ?? defaultBlendTauHours;
  const last = site.length - 1;
  const x = (i: number) => (1000 * i) / Math.max(1, last);
  const points = (value: (s: ChartSample) => number) =>
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
                ? clockTime(window.start) + ' – ' + clockTime(window.end)
                : 'No qualifying stretch'}
            </strong>
            <small>At least 70% clear with good or fair seeing</small>
          </div>
        </div>
        <div className="sky-plot-head">
          <h3>Clear sky</h3>
          <div className="line-legend">
            {hasBlend && <strong className="blend-line">Blend (recommended)</strong>}
            <span className="nowcast-line">Nowcast (wind transport)</span>
            <span className="model-line">Model forecast (Open-Meteo)</span>
          </div>
        </div>
        {hasBlend && (
          <p className="blend-note">
            Blend = wind transport at short range, model later (τ = {tau} h)
          </p>
        )}
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
            {windowEdges.length === 2 && (
              <rect
                x={x(startIndex)}
                width={x(endIndex) - x(startIndex)}
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
            {windowEdges.map((i) => (
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
              className="nowcast-line"
              points={points((s) => s.nowcast.clear)}
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              className="model-line"
              points={points((s) => s.model.clear)}
              vectorEffect="non-scaling-stroke"
            />
            {hasBlend && (
              <polyline
                className="blend-line"
                points={points((s) => cover(s).clear)}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>
        <div className="sky-ticks">
          {ticks.map((i) => (
            <span key={i}>{clockTime(site[i].time)}</span>
          ))}
        </div>
        <div className="sky-plot-head">
          <h3>{coverLabel}</h3>
          <small>0–100% per layer</small>
        </div>
        <div className="cover-bands">
          {layerNames.map((layer, i) => (
            <div key={layer}>
              <span>{layer}</span>
              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon
                  points={'0,100 ' + points((s) => cover(s)[layer]) + ' 1000,100'}
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
              <caption>
                Clear sky and {coverLabel.toLowerCase()} by layer, in percent
              </caption>
              <thead>
                <tr>
                  {[
                    'Local time',
                    ...(hasBlend ? ['Blend clear'] : []),
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
                    {hasBlend && <td>{percent(cover(s).clear)}</td>}
                    <td>{percent(s.nowcast.clear)}</td>
                    <td>{percent(s.model.clear)}</td>
                    {layerNames.map((l) => (
                      <td key={l}>{percent(cover(s)[l])}</td>
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
