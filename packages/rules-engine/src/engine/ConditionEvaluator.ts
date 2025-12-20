import type {Condition, ConditionGroup} from '../types/Condition';
import type {CharacterState} from '../types/CharacterState';
import {getNestedValue} from '../utils/immutable';

/**
 * Evaluates conditions against character state
 */

export class ConditionEvaluator {
  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition: Condition, state: CharacterState): boolean {
    const fieldValue = getNestedValue(state, condition.field);
    const targetValue = condition.value;

    let result = false;

    switch (condition.operator) {
      case 'equals':
        result = fieldValue === targetValue;
        break;

      case 'not_equals':
        result = fieldValue !== targetValue;
        break;

      case 'greater_than':
        result =
          typeof fieldValue === 'number' && typeof targetValue === 'number'
            ? fieldValue > targetValue
            : false;
        break;

      case 'less_than':
        result =
          typeof fieldValue === 'number' && typeof targetValue === 'number'
            ? fieldValue < targetValue
            : false;
        break;

      case 'greater_or_equal':
        result =
          typeof fieldValue === 'number' && typeof targetValue === 'number'
            ? fieldValue >= targetValue
            : false;
        break;

      case 'less_or_equal':
        result =
          typeof fieldValue === 'number' && typeof targetValue === 'number'
            ? fieldValue <= targetValue
            : false;
        break;

      case 'contains':
        if (Array.isArray(fieldValue)) {
          result = fieldValue.includes(targetValue);
        } else if (
          typeof fieldValue === 'string' &&
          typeof targetValue === 'string'
        ) {
          result = fieldValue.includes(targetValue);
        } else if (
          typeof fieldValue === 'object' &&
          fieldValue !== null &&
          (typeof targetValue === 'string' ||
            typeof targetValue === 'number' ||
            typeof targetValue === 'symbol')
        ) {
          // Check if object has property
          result = targetValue in fieldValue;
        }
        break;

      case 'not_contains':
        if (Array.isArray(fieldValue)) {
          result = !fieldValue.includes(targetValue);
        } else if (
          typeof fieldValue === 'string' &&
          typeof targetValue === 'string'
        ) {
          result = !fieldValue.includes(targetValue);
        } else if (
          typeof fieldValue === 'object' &&
          fieldValue !== null &&
          (typeof targetValue === 'string' ||
            typeof targetValue === 'number' ||
            typeof targetValue === 'symbol')
        ) {
          result = !(targetValue in fieldValue);
        }
        break;

      case 'in':
        if (Array.isArray(targetValue)) {
          result = targetValue.includes(fieldValue);
        }
        break;

      case 'not_in':
        if (Array.isArray(targetValue)) {
          result = !targetValue.includes(fieldValue);
        }
        break;
    }

    return result;
  }

  /**
   * Evaluate a condition group (AND/OR/NOR logic)
   */
  evaluateConditionGroup(
    group: ConditionGroup,
    state: CharacterState
  ): boolean {
    const results = group.conditions.map((condition) => {
      // Check if it's a nested group
      if ('operator' in condition && 'conditions' in condition) {
        return this.evaluateConditionGroup(condition as ConditionGroup, state);
      }
      return this.evaluateCondition(condition as Condition, state);
    });

    switch (group.operator) {
      case 'AND':
        return results.every((r) => r === true);
      case 'OR':
        return results.some((r) => r === true);
      case 'NOT':
        return results.every((r) => r === false);
      default:
        return false;
    }
  }

  /**
   * Evaluate conditions (handles both array and group formats)
   */
  evaluate(
    conditions: Condition[] | ConditionGroup | undefined,
    state: CharacterState
  ): boolean {
    if (!conditions) {
      return true; // No conditions means always passes
    }

    // Handle condition group
    if ('operator' in conditions && 'conditions' in conditions) {
      return this.evaluateConditionGroup(conditions, state);
    }

    // Handle array of conditions (implicit AND)
    if (Array.isArray(conditions)) {
      return conditions.every((condition) =>
        this.evaluateCondition(condition, state)
      );
    }

    return true;
  }
}
