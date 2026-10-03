import {describe, expect, it} from 'vitest';
import {
  createEmptyRuleset,
  partitionRulesetRules,
  quarantineInvalidRules,
  WorldRulesetSchema
} from './WorldRuleset';

const validRule = {id: 'rule-1', name: 'Long Rest', category: 'time'};
const invalidRule = {id: 'rule-2', name: 'Broken', category: 'time', effects: [{target: 'stats.STR'}]};

describe('partitionRulesetRules', () => {
  it('keeps valid rules with defaults and quarantines invalid ones verbatim', () => {
    const {rules, quarantinedRules} = partitionRulesetRules([validRule, invalidRule, 'junk']);

    expect(rules).toEqual([{...validRule, enabled: true, priority: 100, tags: [], effects: []}]);
    expect(quarantinedRules).toHaveLength(2);
    expect(quarantinedRules[0]).toMatchObject({raw: invalidRule, name: 'Broken'});
    expect(quarantinedRules[0].issues.some((issue) => issue.startsWith('effects.0.operation'))).toBe(true);
    expect(quarantinedRules[1]).toMatchObject({raw: 'junk', issues: ['rule: Expected object, received string']});
  });

  it('treats a missing rules list as empty', () => {
    expect(partitionRulesetRules(undefined)).toEqual({rules: [], quarantinedRules: []});
  });
});

describe('quarantineInvalidRules', () => {
  it('leaves an all-valid ruleset without a quarantine field', () => {
    const ruleset = {...createEmptyRuleset('Clean'), rules: [validRule]};
    expect(quarantineInvalidRules(ruleset)).not.toHaveProperty('quarantinedRules');
  });

  it('appends to an existing quarantine and is idempotent', () => {
    const ruleset = {
      ...createEmptyRuleset('Mixed'),
      rules: [validRule, invalidRule],
      quarantinedRules: [{raw: {id: 'old'}, issues: ['category: Required']}]
    };
    const once = quarantineInvalidRules(ruleset);
    const twice = quarantineInvalidRules(once);

    expect(once.quarantinedRules?.map((item) => item.raw)).toEqual([{id: 'old'}, invalidRule]);
    expect(twice).toEqual(once);
    expect(WorldRulesetSchema.safeParse(once).success).toBe(true);
  });
});
