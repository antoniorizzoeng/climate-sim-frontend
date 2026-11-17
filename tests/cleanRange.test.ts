import { describe, expect, it } from 'vitest';
import { cleanRange } from '@/lib/model';

describe('cleanRange', () => {
  it('snaps float noise around zero', () => {
    expect(cleanRange([3.6782e-30, 0.99329])).toEqual([0, 0.99329]);
  });
  it('keeps real values and handles empty input', () => {
    expect(cleanRange([-2, 5])).toEqual([-2, 5]);
    expect(cleanRange(null)).toBeNull();
  });
});
