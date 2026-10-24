import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {defineResponseSchema} from './responseSchema';
import {BRAINSTORM_RESPONSE_SCHEMA} from '../worldBible/worldCanvasBrainstorm';
import {CANVAS_COACHING_RESPONSE_SCHEMA} from '../worldBible/worldCanvasCoaching';
import {CHARACTER_PROFILE_RESPONSE_SCHEMA} from '../characterLab/characterFromDescription';

type JsonSchema = {type?: string; properties?: Record<string, JsonSchema>; items?: JsonSchema; required?: string[]; enum?: string[]; anyOf?: JsonSchema[]; maxItems?: number};

describe('defineResponseSchema', () => {
  it('writes the shape the model should produce, without the dialect tag', () => {
    const schema = defineResponseSchema('sample', z.object({
      kind: z.preprocess((value) => value, z.enum(['a', 'b'])),
      notes: z.array(z.string()).transform((notes) => notes.slice(0, 2))
    }));
    expect(schema.name).toBe('sample');
    expect(schema.schema).not.toHaveProperty('$schema');
    const properties = (schema.schema as JsonSchema).properties!;
    expect(properties.kind.enum).toEqual(['a', 'b']);
    expect(properties.notes).toMatchObject({type: 'array', items: {type: 'string'}});
    expect((schema.schema as JsonSchema).required).toEqual(['kind', 'notes']);
  });

  it('gives each structured feature its own constraining schema', () => {
    const brainstorm = BRAINSTORM_RESPONSE_SCHEMA.schema as JsonSchema;
    expect(brainstorm.required).toEqual(['items']);
    expect(brainstorm.properties!.items.items!.properties!.kind.enum).toEqual(['alternative', 'tension', 'implication', 'question']);

    const coaching = CANVAS_COACHING_RESPONSE_SCHEMA.schema as JsonSchema;
    expect(coaching.required).toEqual(['observations', 'proposal']);
    expect(coaching.properties!.observations.maxItems).toBe(3);
    expect(coaching.properties!.proposal.properties!.kind.enum).toEqual(['replacement', 'open-thread']);

    const profile = CHARACTER_PROFILE_RESPONSE_SCHEMA.schema as JsonSchema;
    expect(profile.required).toEqual(['stableFacts', 'suggestedDetails']);
    expect(profile.properties!.stableFacts.items!.properties!.factType.enum!.length).toBeGreaterThan(3);

    for (const {name} of [BRAINSTORM_RESPONSE_SCHEMA, CANVAS_COACHING_RESPONSE_SCHEMA, CHARACTER_PROFILE_RESPONSE_SCHEMA]) {
      expect(name).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    }
  });
});
