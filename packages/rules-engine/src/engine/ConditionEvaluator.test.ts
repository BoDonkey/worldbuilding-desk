import { describe, expect, it } from 'vitest';
import { createEmptyCharacterState } from '../types/CharacterState';
import { ConditionEvaluator } from './ConditionEvaluator';

describe('ConditionEvaluator', () => {
  const evaluator = new ConditionEvaluator();

  const state = {
    ...createEmptyCharacterState(
      'Tester',
      'ruleset-1',
      { strength: 12, agility: 8, class: 'Rogue' },
      { current: { health: 50 }, max: { health: 50 } }
    ),
    custom: {
      tags: ['stealth', 'alchemy'],
      flags: { novice: true }
    }
  };

  it('evaluates single conditions', () => {
    expect(
      evaluator.evaluateCondition(
        { field: 'stats.strength', operator: 'greater_than', value: 10 },
        state
      )
    ).toBe(true);

    expect(
      evaluator.evaluateCondition(
        { field: 'stats.class', operator: 'equals', value: 'Mage' },
        state
      )
    ).toBe(false);
  });

  it('evaluates condition arrays with implicit AND', () => {
    const result = evaluator.evaluate(
      [
        { field: 'stats.strength', operator: 'greater_or_equal', value: 12 },
        { field: 'custom.tags', operator: 'contains', value: 'stealth' }
      ],
      state
    );

    expect(result).toBe(true);
  });

  it('evaluates nested groups including NOT', () => {
    const result = evaluator.evaluate(
      {
        operator: 'AND',
        conditions: [
          { field: 'stats.class', operator: 'equals', value: 'Rogue' },
          {
            operator: 'NOT',
            conditions: [
              {
                field: 'custom.tags',
                operator: 'contains',
                value: 'heavy-armor'
              }
            ]
          }
        ]
      },
      state
    );

    expect(result).toBe(true);
  });
});
