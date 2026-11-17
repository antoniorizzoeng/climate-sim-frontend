import { useEffect, useRef } from 'react';
import { examplePlane, examples } from '@/lib/examples';
import { pixels } from '@/lib/model';

function Preview({ example }: { example: (typeof examples)[number] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const plane = examplePlane(example, 128, 64);
    const img = ctx.createImageData(plane.nx, plane.ny);
    img.data.set(pixels(plane, 'inferno', 0, 1));
    ctx.putImageData(img, 0, 0);
  }, [example]);
  return <canvas ref={canvas} width={128} height={64} aria-hidden="true" />;
}

export function Examples({
  selected,
  choose,
  disabled,
}: {
  selected: string;
  choose: (example: (typeof examples)[number]) => void;
  disabled: boolean;
}) {
  return (
    <section className="examples" aria-labelledby="examples-heading">
      <h2 id="examples-heading">Examples</h2>
      <div className="example-strip">
        {examples.map((example) => (
          <button
            key={example.name}
            disabled={disabled}
            aria-pressed={selected === example.name}
            onClick={() => choose(example)}
          >
            <Preview example={example} />
            <span>
              <strong>{example.name}</strong>
              <small>{example.motion}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
