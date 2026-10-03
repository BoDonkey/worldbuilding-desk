import {afterEach, describe, expect, it, vi} from 'vitest';
import {createEmptyCharacterState} from '../types/CharacterState';
import {DISABLED_FORMULA_FUNCTIONS, FormulaParser} from './FormulaParser';

const state = createEmptyCharacterState(
  'Tester',
  'ruleset-1',
  {STR: 14, INT: 9},
  {current: {health: 30, mana: 5}, max: {health: 40, mana: 20}}
);

describe('FormulaParser', () => {
  const parser = new FormulaParser();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('evaluates arithmetic over stats and resources', () => {
    expect(parser.evaluate('STR * 2 + 1', state)).toBe(29);
    expect(parser.evaluate('maxHealth - health', state)).toBe(10);
    expect(parser.evaluate('floor(INT / 2)', state)).toBe(4);
    expect(parser.evaluate('resources.max.mana', state)).toBe(20);
  });

  it('replaces dice notation with a roll inside the expected range', () => {
    for (let i = 0; i < 25; i++) {
      const value = parser.evaluate('2d6 + STR', state);
      expect(value).toBeGreaterThanOrEqual(16);
      expect(value).toBeLessThanOrEqual(26);
    }
  });

  it.each(DISABLED_FORMULA_FUNCTIONS)('refuses %s inside a formula', (name) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const formulas: Record<(typeof DISABLED_FORMULA_FUNCTIONS)[number], string> = {
      import: 'import({pi: 3}, {override: true})',
      createUnit: 'createUnit("foo")',
      evaluate: 'evaluate("STR + 1000")',
      parse: 'parse("1 + 1")',
      compile: 'compile("1 + 1")',
      simplify: 'simplify("2 * x")',
      derivative: 'derivative("x^2", "x")',
      resolve: 'resolve(parse("x"), {x: 1})',
      reviver: 'reviver("a", 1)'
    };

    expect(parser.evaluate(formulas[name], state)).toBe(0);
    expect(errors).toHaveBeenCalled();
    expect(String(errors.mock.calls[0]?.[1])).toMatch(/disabled in formulas/);
  });

  it('keeps the shared math instance intact after a refused import', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    parser.evaluate('import({pi: 3}, {override: true})', state);
    expect(parser.evaluate('round(pi * 100)', state)).toBe(314);
  });

  it('validates syntax and lists variables without evaluating', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(parser.validate('STR * (INT + 2)')).toEqual({valid: true});
    expect(parser.validate('STR * (').valid).toBe(false);
    expect(parser.extractVariables('STR * INT + health').sort()).toEqual(['INT', 'STR', 'health']);
  });
});
