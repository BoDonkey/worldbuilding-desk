// Main exports
export * from './types';
export * from './engine';
export * from './utils';
export * from './state';

// Re-export main classes for convenience
export { RulesEngine } from './engine/RulesEngine';
export { ConditionEvaluator } from './engine/ConditionEvaluator';
export { EffectApplicator } from './engine/EffectApplicator';
export { FormulaParser } from './engine/FormulaParser';
export { StateManager } from './state/StateManager';