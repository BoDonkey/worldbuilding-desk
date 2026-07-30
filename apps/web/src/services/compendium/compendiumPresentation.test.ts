import {describe, expect, it} from 'vitest';
import type {
  Character,
  PartySynergySuggestion,
  SettlementAuraEffect
} from '../../entityTypes';
import {
  formatSettlementEffectLabel,
  formatSynergyStatus,
  getCharacterRole
} from './compendiumPresentation';

const character = (id: string, name: string, role?: string): Character => ({
  id,
  projectId: 'project-1',
  name,
  fields: {role},
  createdAt: 1,
  updatedAt: 1
});

describe('compendium presentation helpers', () => {
  it.each([
    ['add', '+5'],
    ['multiply', 'x1.5'],
    ['set', '=true']
  ] as const)('formats %s settlement effects', (operation, expectedValue) => {
    const effect: SettlementAuraEffect = {
      targetType: 'stat',
      targetId: 'defense',
      operation,
      value:
        operation === 'multiply' ? 1.5 : operation === 'set' ? true : 5
    };

    expect(formatSettlementEffectLabel(effect)).toBe(
      `stat:defense ${expectedValue}`
    );
  });

  it('normalizes character roles for display', () => {
    expect(getCharacterRole(character('a', 'Aria', '  scout  '))).toBe('scout');
    expect(getCharacterRole(character('b', 'Borin'))).toBe('');
  });

  it('describes active and incomplete party synergies', () => {
    const characters = new Map([
      ['a', character('a', 'Aria', 'scout')],
      ['b', character('b', 'Borin', 'tank')]
    ]);
    const suggestion: PartySynergySuggestion = {
      ruleId: 'balanced-party',
      ruleName: 'Balanced Party',
      matchedCharacterIds: ['a', 'b'],
      missingRoles: [],
      effectDescription: 'Party gains a bonus.'
    };

    expect(formatSynergyStatus(suggestion, characters)).toBe(
      'Active via Aria, Borin.'
    );
    expect(
      formatSynergyStatus(
        {...suggestion, matchedCharacterIds: ['a'], missingRoles: ['healer']},
        characters
      )
    ).toBe('Need healer. Current: Aria.');
  });
});
