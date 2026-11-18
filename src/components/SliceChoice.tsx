import { useEffect, useRef, useState } from 'react';

export function SliceChoice({
  layers,
  keep,
  cancel,
}: {
  layers: number;
  keep: (z: number) => void;
  cancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const middle = Math.floor(layers / 2);
  const [choice, setChoice] = useState('middle');
  const [custom, setCustom] = useState(String(middle));
  const z =
    choice === 'custom'
      ? Number(custom)
      : choice === 'top'
        ? layers - 1
        : choice === 'middle'
          ? middle
          : 0;
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="slice-title"
      className="slice-choice"
      onCancel={cancel}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          keep(z);
        }}
      >
        <h2 id="slice-title">Keep one slice in 2D</h2>
        <label>
          Slice to keep
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="top">Top · z = {layers - 1}</option>
            <option value="middle">Middle · z = {middle}</option>
            <option value="bottom">Bottom · z = 0</option>
            <option value="custom">Choose z</option>
          </select>
        </label>
        {choice === 'custom' && (
          <label>
            Layer z
            <input
              type="number"
              required
              min={0}
              max={layers - 1}
              step={1}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
        )}
        <div className="two-actions">
          <button type="button" className="secondary" onClick={cancel}>
            Cancel
          </button>
          <button className="primary">Keep slice</button>
        </div>
      </form>
    </dialog>
  );
}
