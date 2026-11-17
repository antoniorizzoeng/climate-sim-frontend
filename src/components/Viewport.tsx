import { useLayoutEffect, useRef, useState } from 'react';
import { Grid2X2, Maximize2, ScanLine } from 'lucide-react';
import { gradient, numberText, type ColorMap } from '@/lib/model';

type Props = {
  nx: number;
  ny: number;
  map: ColorMap;
  range: number[];
  children: React.ReactNode;
  mode: string;
  readout?: string;
  controls?: React.ReactNode;
  reference?: React.ReactNode;
  currentLabel?: string;
  chart?: React.ReactNode;
};
export function Viewport({
  nx,
  ny,
  map,
  range,
  children,
  mode,
  readout,
  controls,
  reference,
  currentLabel,
  chart,
}: Props) {
  const [grid, setGrid] = useState(true),
    [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    expandButton = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);
  useLayoutEffect(() => {
    if (expanded) {
      dialog.current?.showModal();
      opened.current = true;
    }
    if (opened.current) expandButton.current?.focus();
  }, [expanded]);
  const plot = (content: React.ReactNode) => (
    <div className="plot-wrap">
      <div className="y-axis">
        {[1, 0.75, 0.5, 0.25, 0].map((f) => (
          <span key={f}>{Math.round(f * (ny - 1))}</span>
        ))}
      </div>
      <div className="plot" style={{ aspectRatio: String(nx / ny) }}>
        {content}
        {grid && <div className="grid-overlay" />}
      </div>
      <div className="x-axis">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f}>{Math.round(f * (nx - 1))}</span>
        ))}
      </div>
    </div>
  );
  const body = (
    <>
      <header className="panel-head">
        <h2>
          <ScanLine size={17} />
          Field viewport
        </h2>
        <div className="inline">
          <span className="mode-tag">{mode}</span>
          <button
            className={'icon-btn' + (grid ? ' on' : '')}
            title="Toggle coordinate grid"
            aria-label="Toggle coordinate grid"
            aria-pressed={grid}
            onClick={() => setGrid(!grid)}
          >
            <Grid2X2 size={16} />
          </button>
          <button
            className="icon-btn"
            ref={expandButton}
            title={expanded ? 'Close expanded viewport' : 'Expand viewport'}
            aria-label={expanded ? 'Close expanded viewport' : 'Expand viewport'}
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </header>
      {controls}
      <div className={reference ? 'compare-plots' : ''}>
        {reference && (
          <div>
            <div className="plot-caption">First · frame 1</div>
            {plot(reference)}
          </div>
        )}
        <div>
          {reference && <div className="plot-caption">{currentLabel}</div>}
          {plot(children)}
        </div>
      </div>
      <div className="legend">
        <div>
          <span className="micro">FIELD INTENSITY</span>
          <span className="map-name">{map}</span>
        </div>
        <div className="colorbar" style={{ background: gradient(map) }} />
        <div className="legend-values">
          <span>{numberText(range[0])}</span>
          <span>{numberText((range[0] + range[1]) / 2)}</span>
          <span>{numberText(range[1])}</span>
        </div>
      </div>
      {chart}
      <footer className="viewport-foot">
        <span>
          <i className="dot peach" />
          {nx} × {ny} <em>cells</em>
        </span>
        <span>{readout || 'x, y · cell coordinates'}</span>
      </footer>
    </>
  );
  return expanded ? (
    <dialog
      ref={dialog}
      className="panel viewport expanded"
      aria-label="Field viewport"
      onCancel={() => setExpanded(false)}
    >
      {body}
    </dialog>
  ) : (
    <section className="panel viewport" aria-label="Field viewport">
      {body}
    </section>
  );
}
