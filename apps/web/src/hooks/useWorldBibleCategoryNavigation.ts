import {useEffect, useMemo, useState} from 'react';
import type {EntityCategory} from '../entityTypes';
import {useCollapsedPreference} from './useCollapsedPreference';
import {isCharacterCategory} from '../services/worldBible/worldBibleSummary';
import {isSystemNegativeSpaceCategory} from '../services/worldBible/systemNegativeSpace';

export type WorldBibleViewMode = 'category' | 'review';

const getWorldBibleRailStorageKey = (projectId: string) =>
  `wbd:world-bible:category-rail-collapsed:${projectId}`;

interface UseWorldBibleCategoryNavigationOptions {
  projectId: string | null;
  categories: EntityCategory[];
  /** System negative space is a game-systems category; it hides when they are off. */
  showGameSystems: boolean;
}

/**
 * Where the author is in World Bible: the categories the rail shows, the
 * selected category or review queue, and whether the rail is collapsed.
 */
export function useWorldBibleCategoryNavigation({
  projectId,
  categories,
  showGameSystems
}: UseWorldBibleCategoryNavigationOptions) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<WorldBibleViewMode>('category');
  const {collapsed: isCategoryRailCollapsed, toggle: toggleCategoryRail} = useCollapsedPreference(
    projectId ? getWorldBibleRailStorageKey(projectId) : null
  );

  const worldBibleCategories = useMemo(
    () => showGameSystems
      ? categories
      : categories.filter((category) => !isSystemNegativeSpaceCategory(category)),
    [categories, showGameSystems]
  );

  // Keep a visible category selected as categories load or hide.
  useEffect(() => {
    if (
      worldBibleCategories.length > 0 &&
      !worldBibleCategories.some((category) => category.id === activeTab)
    ) {
      setActiveTab(worldBibleCategories[0].id);
    }
  }, [worldBibleCategories, activeTab]);

  const activeCategory = worldBibleCategories.find((c) => c.id === activeTab);
  const characterCategory = useMemo(
    () => categories.find((category) => isCharacterCategory(category)) ?? null,
    [categories]
  );
  const activeCategoryIsCharacterLike = useMemo(
    () => Boolean(activeCategory && isCharacterCategory(activeCategory)),
    [activeCategory]
  );

  return {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    worldBibleCategories,
    activeCategory,
    characterCategory,
    activeCategoryIsCharacterLike,
    activeCategoryIsSystemNegativeSpace: isSystemNegativeSpaceCategory(activeCategory),
    isCategoryRailCollapsed,
    toggleCategoryRail
  };
}
