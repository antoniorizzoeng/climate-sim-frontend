import { useState, type ComponentProps } from 'react';
import { numberText } from '@/lib/model';

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  value: number | string;
  onEdit: (raw: string) => void;
};

// Keep the model's exact value until the user actually edits this input.
export function DecimalInput({ value, onEdit, ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = value === '' ? '' : numberText(Number(value));
  return (
    <input
      {...props}
      type="number"
      step="any"
      value={
        draft !== null && (draft === '' || Number(draft) === Number(value))
          ? draft
          : display
      }
      onChange={(e) => {
        setDraft(e.target.value);
        onEdit(e.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
