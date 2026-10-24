import {z} from 'zod';
import type {LLMResponseSchema} from './types';

/**
 * The JSON Schema a structured request hands to a local model server, so the
 * server constrains decoding and a small model returns parseable JSON more
 * often (Slice 4.68). Built from the feature's own Zod schema, as the shape
 * the model should write (`io: 'input'`, so a `preprocess` contributes its
 * target enum and a `transform` its input type). Refinements a JSON Schema
 * cannot express are left out. Constraining changes only how often parsing
 * succeeds: every reply is still parsed and validated by the feature's Zod
 * schema, and nothing is accepted without the author.
 */
export function defineResponseSchema(name: string, schema: z.ZodType): LLMResponseSchema {
  const {$schema: _dialect, ...jsonSchema} = z.toJSONSchema(schema, {io: 'input', unrepresentable: 'any'}) as Record<
    string,
    unknown
  >;
  void _dialect;
  return {name, schema: jsonSchema};
}
