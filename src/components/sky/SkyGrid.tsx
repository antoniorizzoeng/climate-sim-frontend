import { Grid2X2 } from 'lucide-react';
import type { Nowcast } from '@/lib/sky';

export function SkyGrid({ grid }: { grid: Nowcast['grid'] }) {
  const widthKm = (grid.nx * grid.dx_m) / 1000;
  const heightKm = (grid.ny * grid.dy_m) / 1000;
  const target = widthKm / 2;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const scale = ([5, 2, 1].find((n) => n * magnitude <= target) ?? 1) * magnitude;
  const barWidth = (100 * scale) / widthKm;
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>
          <Grid2X2 size={16} />
          Model grid
        </h2>
      </header>
      <div className="grid-summary">
        <svg
          viewBox="0 0 130 141"
          role="img"
          aria-label={
            'Site at the centre of a ' +
            widthKm.toFixed(1) +
            ' kilometre wide grid. Scale bar ' +
            scale +
            ' kilometres.'
          }
        >
          <defs>
            <pattern
              id="sky-grid-lines"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path d="M10 0H0V10" fill="none" stroke="#64717b" strokeWidth=".7" />
            </pattern>
          </defs>
          <rect
            x="10"
            y="10"
            width="100"
            height="100"
            fill="url(#sky-grid-lines)"
            stroke="#7c8891"
          />
          <circle
            cx="60"
            cy="60"
            r="5"
            fill="#13151a"
            stroke="#ffad86"
            strokeWidth="2"
          />
          <path
            d="M60 48v6m0 12v6m-12-12h6m12 0h6"
            stroke="#ffad86"
            strokeWidth="1.5"
          />
          <text x="116" y="20">
            N
          </text>
          <path d={`M10 116v4h${barWidth}v-4`} stroke="#e6ded7" fill="none" />
          <text x="10" y="134">
            {scale} km
          </text>
        </svg>
        <div>
          <strong>
            {grid.nx} × {grid.ny} cells
          </strong>
          <p>
            {widthKm.toFixed(1)} × {heightKm.toFixed(1)} km
          </p>
          <p>
            {(grid.dx_m / 1000).toFixed(2)} × {(grid.dy_m / 1000).toFixed(2)} km per
            cell
          </p>
          <small>
            Southwest cell centre
            <br />
            {grid.lat0.toFixed(3)}°, {grid.lon0.toFixed(3)}°
          </small>
        </div>
      </div>
    </section>
  );
}
