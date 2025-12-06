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

      case 'notEquals':
        result = fieldValue !== targetValue;
        break;

      case 'greaterThan':
        result =
          typeof fieldValue === 'number' && typeof targetValue === 'number'
            ? fieldValue > targetValue
            : false;
        break;

      case 'lessThan':
        result =
          typeof fieldValue === 'number' && typeof targetValue === 'number'
            ? fieldValue < targetValue
            : false;
        break;

      case 'greaterThanOrEqual':
        result =
          typeof fieldValue === 'number' && typeof targetValue === 'number'
            ? fieldValue >= targetValue
            : false;
        break;

      case 'lessThanOrEqual':
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
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          // Check if object has property
          result = targetValue in fieldValue;
        }
        break;

      case 'notContains':
        if (Array.isArray(fieldValue)) {
          result = !fieldValue.includes(targetValue);
        } else if (
          typeof fieldValue === 'string' &&
          typeof targetValue === 'string'
        ) {
          result = !fieldValue.includes(targetValue);
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          result = !(targetValue in fieldValue);
        }
        break;

      case 'in':
        if (Array.isArray(targetValue)) {
          result = targetValue.includes(fieldValue);
        }
        break;

      case 'notIn':
        if (Array.isArray(targetValue)) {
          result = !targetValue.includes(fieldValue);
        }
        break;
    }

    // Apply negation if specified
    return condition.negate ? !result : result;
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
      case 'all':
        return results.every((r) => r === true);
      case 'any':
        return results.some((r) => r === true);
      case 'none':
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
