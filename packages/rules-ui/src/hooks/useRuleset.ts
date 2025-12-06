import {useState, useCallback} from 'react';
import type {
  WorldRuleset,
  StatDefinition,
  ResourceDefinition,
  GameRule
} from '@litrpg-tool/rules-engine';
import {createEmptyRuleset} from '@litrpg-tool/rules-engine';

export function useRuleset(initialRuleset?: WorldRuleset) {
  const [ruleset, setRuleset] = useState<WorldRuleset>(
    initialRuleset || createEmptyRuleset('Untitled World')
  );

  const updateRuleset = useCallback((updates: Partial<WorldRuleset>) => {
    setRuleset((prev) => ({
      ...prev,
      ...updates,
      updatedAt: Date.now()
    }));
  }, []);

  const addStat = useCallback((stat: StatDefinition) => {
    setRuleset((prev) => ({
      ...prev,
      statDefinitions: [...prev.statDefinitions, stat],
      updatedAt: Date.now()
    }));
  }, []);

  const updateStat = useCallback(
    (id: string, updates: Partial<StatDefinition>) => {
      setRuleset((prev) => ({
        ...prev,
        statDefinitions: prev.statDefinitions.map((stat) =>
          stat.id === id ? {...stat, ...updates} : stat
        ),
        updatedAt: Date.now()
      }));
    },
    []
  );

  const removeStat = useCallback((id: string) => {
    setRuleset((prev) => ({
      ...prev,
      statDefinitions: prev.statDefinitions.filter((stat) => stat.id !== id),
      updatedAt: Date.now()
    }));
  }, []);

  const addResource = useCallback((resource: ResourceDefinition) => {
    setRuleset((prev) => ({
      ...prev,
      resourceDefinitions: [...prev.resourceDefinitions, resource],
      updatedAt: Date.now()
    }));
  }, []);

  const updateResource = useCallback(
    (id: string, updates: Partial<ResourceDefinition>) => {
      setRuleset((prev) => ({
        ...prev,
        resourceDefinitions: prev.resourceDefinitions.map((res) =>
          res.id === id ? {...res, ...updates} : res
        ),
        updatedAt: Date.now()
      }));
    },
    []
  );

  const removeResource = useCallback((id: string) => {
    setRuleset((prev) => ({
      ...prev,
      resourceDefinitions: prev.resourceDefinitions.filter(
        (res) => res.id !== id
      ),
      updatedAt: Date.now()
    }));
  }, []);

  const addRule = useCallback((rule: GameRule) => {
    setRuleset((prev) => ({
      ...prev,
      rules: [...prev.rules, rule],
      updatedAt: Date.now()
    }));
  }, []);

  const updateRule = useCallback((id: string, updates: Partial<GameRule>) => {
    setRuleset((prev) => ({
      ...prev,
      rules: prev.rules.map((rule) =>
        rule.id === id ? {...rule, ...updates} : rule
      ),
      updatedAt: Date.now()
    }));
  }, []);

  const removeRule = useCallback((id: string) => {
    setRuleset((prev) => ({
      ...prev,
      rules: prev.rules.filter((rule) => rule.id !== id),
      updatedAt: Date.now()
    }));
  }, []);

  return {
    ruleset,
    updateRuleset,
    addStat,
    updateStat,
    removeStat,
    addResource,
    updateResource,
    removeResource,
    addRule,
    updateRule,
    removeRule
  };
}
