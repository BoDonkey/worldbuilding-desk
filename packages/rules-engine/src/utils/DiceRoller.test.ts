import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiceRoller } from './DiceRoller';

describe('DiceRoller', () => {
  const roller = new DiceRoller();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rolls deterministically when Math.random is mocked', () => {
    const random = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0) // 1 on d6
      .mockReturnValueOnce(0.5); // 4 on d6

    const result = roller.rollWithDetails('2d6+3');

    expect(random).toHaveBeenCalledTimes(2);
    expect(result.rolls).toEqual([1, 4]);
    expect(result.total).toBe(8);
    expect(result.notation).toBe('2d6+3');
  });

  it('validates notation and reports invalid expressions', () => {
    expect(roller.validate('2d6+1').valid).toBe(true);

    const invalid = roller.validate('2dd6');
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBe('Invalid dice notation format');
  });

  it('computes average and range correctly', () => {
    expect(roller.average('2d6+2')).toBe(9);
    expect(roller.range('2d6+2')).toEqual({ min: 4, max: 14 });
  });
});
