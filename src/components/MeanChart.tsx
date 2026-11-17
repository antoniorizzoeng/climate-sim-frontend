import { memo } from 'react';
import { numberText } from '@/lib/model';
export type MeanSample = { index: number; mean: number };
// One representative per horizontal chart pixel bounds memory on long runs.
export const chartInterval = (count: number) => Math.max(1, Math.ceil(count / 156));

export const MeanChart = memo(function MeanChart({
  means,
  current,
  stride,
  last,
}: {
  means: Map<number, MeanSample>;
  current?: MeanSample;
  stride: number;
  last: number;
}) {
  const samples = Array.from(means.values()).sort((a, b) => a.index - b.index);
  const currentMean =
    current && Number.isFinite(current.mean) ? current.mean : undefined;
  let lo = currentMean ?? Infinity,
    hi = currentMean ?? -Infinity;
  for (const { mean } of samples) {
    lo = Math.min(mean, lo);
    hi = Math.max(mean, hi);
  }
  const extent = Math.max(hi - lo, Math.max(1, Math.abs(lo)) * 1e-7);
  const x = (i: number) => 2 + (156 * i) / Math.max(1, last);
  const y = (m: number) => 16 - (26 * (m - (lo + hi) / 2)) / extent;
  const path = samples
    .map(({ index, mean }, j) => {
      const consecutive =
        j > 0 && index - samples[j - 1].index <= chartInterval(last + 1);
      return (
        (consecutive ? 'L' : 'M') +
        x(index) +
        ' ' +
        y(mean) +
        (consecutive ? '' : 'h0.2')
      );
    })
    .join(' ');
  const title = stride > 1 ? 'Sampled field mean' : 'Field mean';
  return (
    <div className="mean-chart">
      <span>
        {title}
        <strong>{currentMean !== undefined ? numberText(currentMean) : '—'}</strong>
      </span>
      <svg
        viewBox="0 0 160 32"
        role="img"
        aria-label={title + ' over time for ' + samples.length + ' loaded frames'}
      >
        <path d="M2 16H158" stroke="var(--line)" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" />
        {current && currentMean !== undefined && (
          <circle
            cx={x(current.index)}
            cy={y(currentMean)}
            r="2.5"
            fill="currentColor"
          />
        )}
      </svg>
    </div>
  );
});
