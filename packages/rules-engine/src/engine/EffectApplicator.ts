import type {Effect} from '../types/Effect';
import type {CharacterState} from '../types/CharacterState';
import {getNestedValue, setNestedValue, updateState} from '../utils/immutable';
import {FormulaParser} from './FormulaParser';

/**
 * Applies effects to character state
 */

export class EffectApplicator {
  private formulaParser: FormulaParser;

  constructor() {
    this.formulaParser = new FormulaParser();
  }

  /**
   * Apply a single effect to state
   */
  applyEffect(effect: Effect, state: CharacterState): CharacterState {
    const currentValue = getNestedValue(state, effect.target);
    let newValue: any;

    // Resolve the effect value (might be a formula)
    const resolvedValue = this.resolveValue(effect.value, state);

    switch (effect.operation) {
      case 'set':
        newValue = resolvedValue;
        break;

      case 'add':
        if (
          typeof currentValue === 'number' &&
          typeof resolvedValue === 'number'
        ) {
          newValue = currentValue + resolvedValue;
        } else if (Array.isArray(currentValue)) {
          newValue = [...currentValue, resolvedValue];
        } else {
          newValue = resolvedValue;
        }
        break;

      case 'subtract':
        if (
          typeof currentValue === 'number' &&
          typeof resolvedValue === 'number'
        ) {
          newValue = currentValue - resolvedValue;
        } else {
          newValue = currentValue;
        }
        break;

      case 'multiply':
        if (
          typeof currentValue === 'number' &&
          typeof resolvedValue === 'number'
        ) {
          newValue = currentValue * resolvedValue;
        } else {
          newValue = currentValue;
        }
        break;

      case 'divide':
        if (
          typeof currentValue === 'number' &&
          typeof resolvedValue === 'number'
        ) {
          newValue =
            resolvedValue !== 0 ? currentValue / resolvedValue : currentValue;
        } else {
          newValue = currentValue;
        }
        break;

      case 'append':
        if (Array.isArray(currentValue)) {
          newValue = [...currentValue, resolvedValue];
        } else if (typeof currentValue === 'object' && currentValue !== null) {
          newValue = {...currentValue, ...resolvedValue};
        } else {
          newValue = [currentValue, resolvedValue];
        }
        break;

      case 'remove':
        if (Array.isArray(currentValue)) {
          newValue = currentValue.filter((item) => {
            // Handle removing by ID or direct value
            if (typeof item === 'object' && item !== null && 'id' in item) {
              return item.id !== resolvedValue;
            }
            return item !== resolvedValue;
          });
        } else if (typeof currentValue === 'object' && currentValue !== null) {
          const {[resolvedValue]: removed, ...rest} = currentValue;
          newValue = rest;
        } else {
          newValue = currentValue;
        }
        break;

      default:
        newValue = currentValue;
    }

    // Apply min/max constraints if specified
    if (typeof newValue === 'number') {
      if (effect.min !== undefined && newValue < effect.min) {
        newValue = effect.min;
      }
      if (effect.max !== undefined && newValue > effect.max) {
        newValue = effect.max;
      }
    }

    // Update state immutably
    return setNestedValue(state, effect.target, newValue);
  }

  /**
   * Apply multiple effects to state
   */
  applyEffects(effects: Effect[], state: CharacterState): CharacterState {
    return effects.reduce((currentState, effect) => {
      return this.applyEffect(effect, currentState);
    }, state);
  }

  /**
   * Resolve effect value (handle formulas)
   */
  private resolveValue(value: any, state: CharacterState): any {
    // If it's a string, might be a formula
    if (typeof value === 'string') {
      // Check if it looks like a formula (contains operators or known variables)
      if (this.looksLikeFormula(value)) {
        return this.formulaParser.evaluate(value, state);
      }
      return value;
    }

    // For objects, might need to resolve nested formulas
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const resolved: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveValue(val, state);
      }
      return resolved;
    }

    return value;
  }

  /**
   * Quick heuristic to detect if string is likely a formula
   */
  private looksLikeFormula(str: string): boolean {
    // Contains math operators or common stat names
    return (
      /[+\-*/()]/.test(str) ||
      /\b(STR|AGI|INT|WIS|character|stats|health|mana)\b/.test(str)
    );
  }
}
