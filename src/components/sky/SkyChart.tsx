import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function WindTooltip({ anchor, text }: { anchor: HTMLElement; text: string }) {
  const tip = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    function place() {
      if (!tip.current) return;
      const box = anchor.getBoundingClientRect(),
        { width, height } = tip.current.getBoundingClientRect();
      const above = box.top - height - 4;
      tip.current.style.top =
        Math.max(
          4,
          above >= 4
            ? above
            : Math.min(window.innerHeight - height - 4, box.bottom + 4),
        ) + 'px';
      tip.current.style.left =
        Math.max(4, Math.min(box.left, window.innerWidth - width - 4)) + 'px';
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, text]);
  return createPortal(
    <span role="tooltip" ref={tip} className="sky-wind-tooltip">
      {text}
    </span>,
    document.body,
  );
}
export function SeeingStrip({ site }: { site: SeeingSample[] }) {
  const [tip, setTip] = useState<{ anchor: HTMLElement; text: string }>();
  return (
    <div className="seeing-strip" role="group" aria-label="Hourly seeing">
      {seeingHours(site).map((s) => {
        const wind = `250 hPa wind · ${s.jet_ms.toFixed(1)} m/s`;
        return (
          <span
            key={s.time}
            role="img"
            className={'seeing-chip ' + s.seeing}
            onFocus={(e) => setTip({ anchor: e.currentTarget, text: wind })}
            onBlur={() => setTip(undefined)}
            onMouseEnter={(e) => setTip({ anchor: e.currentTarget, text: wind })}
            onMouseLeave={() => setTip(undefined)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setTip(undefined);
            }}
            tabIndex={0}
            aria-label={localStamp(s.time) + ', ' + s.seeing + ', ' + wind}
          >
            <time dateTime={s.time}>{clockTime(s.time)}</time>
            <b>{s.seeing}</b>
          </span>
        );
      })}
      {tip && <WindTooltip {...tip} />}
    </div>
  );
}

const percent = (v: number) => Math.round(100 * v) + '%';
// Older backends and saved forecasts can omit these fields.
type ChartSample = Omit<SiteSample, 'blend'> & Partial<Pick<SiteSample, 'blend'>>;
type ChartRecord = Omit<Nowcast, 'site' | 'best_window' | 'night'> & {
  site: ChartSample[] | null;
  night?: Nowcast['night'];
  best_window?: Nowcast['best_window'];
};

export function SkyChart({ record }: { record?: ChartRecord }) {
  const site = record?.site;
  const label =
    record?.params.window === 'now' ? 'Next hours at a glance' : 'Tonight at a glance';
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
  const night = record.night;
  const nightSamples = night
    ? site.filter(
        (s) =>
          Date.parse(s.time) >= Date.parse(night.dusk) &&
          Date.parse(s.time) <= Date.parse(night.dawn),
      )
    : site;
  const legacyWindow =
    record.best_window === undefined ? bestWindow(nightSamples) : undefined;
  const candidate =
    record.best_window ??
    (legacyWindow && {
      start: nightSamples[legacyWindow.start].time,
      end: nightSamples[legacyWindow.end].time,
    });
  const windowSamples = candidate
    ? nightSamples.filter(
        (s) =>
          Date.parse(s.time) >= Date.parse(candidate.start) &&
          Date.parse(s.time) <= Date.parse(candidate.end),
      )
    : [];
  const window = windowSamples.length
    ? {
        start: windowSamples[0].time,
        end: windowSamples[windowSamples.length - 1].time,
      }
    : undefined;
  const startIndex = window ? site.indexOf(windowSamples[0]) : -1;
  const endIndex = window ? site.indexOf(windowSamples[windowSamples.length - 1]) : -1;
  const windowEdges = night && window ? [...new Set([startIndex, endIndex])] : [];
  const hasBlend = site.every((sample) => sample.blend);
  const cover = (sample: ChartSample) =>
    (hasBlend ? sample.blend : undefined) ?? sample.nowcast;
  const coverLabel = hasBlend ? 'Blended cloud cover' : 'Nowcast cloud cover';
  const tau = record.params.blend_tau_hours ?? defaultBlendTauHours;
  const last = site.length - 1;
  const start = Date.parse(site[0].time);
  const timeX = (iso: string) =>
    (1000 * (Date.parse(iso) - start)) /
    Math.max(1, Date.parse(site[last].time) - start);
  const x = (i: number) => timeX(site[i].time);
  const dusk = night ? Math.max(0, Math.min(1000, timeX(night.dusk))) : 0;
  const dawn = night ? Math.max(0, Math.min(1000, timeX(night.dawn))) : 0;
  const nightBand = night && (
    <>
      <rect
        className="night-band"
        x={dusk}
        width={Math.max(0, dawn - dusk)}
        height="100"
      />
      {[night.dusk, night.dawn]
        .filter((t) => timeX(t) >= 0 && timeX(t) <= 1000)
        .map((t) => (
          <line
            key={t}
            className="twilight-marker"
            x1={timeX(t)}
            x2={timeX(t)}
            y1="0"
            y2="100"
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </>
  );
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
            <span>{night ? 'Best observing window' : 'Best forecast window'}</span>
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
            <span className="model-line">
              {process.env.NEXT_PUBLIC_DEMO_BASE_PATH
                ? 'Model forecast (simulated)'
                : 'Model forecast (Open-Meteo)'}
            </span>
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
            {nightBand}
            {windowEdges.length === 2 && (
              <rect
                className="window-highlight"
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
        {night && (
          <section aria-label="Astronomical night">
            <p className="night-caption">
              Astronomical twilight · Dusk {localStamp(night.dusk)} · Dawn{' '}
              {localStamp(night.dawn)}
            </p>
            {night.moon.length > 0 && (
              <>
                <div className="sky-plot-head">
                  <h3>Moon altitude</h3>
                  <small>
                    {percent(night.moon[0].illumination)} illuminated at{' '}
                    {clockTime(night.moon[0].time)}
                  </small>
                </div>
                <div className="clear-plot moon-plot">
                  <div className="clear-axis">
                    <span>90°</span>
                    <span>0°</span>
                    <span>−90°</span>
                  </div>
                  <svg
                    viewBox="0 0 1000 100"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Moon altitude above or below the horizon over time"
                  >
                    {nightBand}
                    <line
                      x1="0"
                      x2="1000"
                      y1="50"
                      y2="50"
                      stroke="#85868c"
                      strokeDasharray="4 4"
                    />
                    <polyline
                      points={night.moon
                        .map(
                          (m) =>
                            timeX(m.time) + ',' + (50 - (m.altitude_deg * 50) / 90),
                        )
                        .join(' ')}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </>
            )}
          </section>
        )}
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
            Ten-minute site samples{' '}
            <span className="disclosure-hint">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
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
