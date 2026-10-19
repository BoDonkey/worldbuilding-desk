import {useState} from 'react';
import type {UnlockableRecipe} from '../../entityTypes';
import {saveUnlockableRecipe} from '../../services/compendium';
import {parseCommaSeparatedIds} from '../../services/compendium/compendiumFormValues';
import {describeError} from '../../services/errors';
import type {CompendiumFormContext, SetFormValue} from './formTypes';

interface Options extends CompendiumFormContext {
  setRecipes: SetFormValue<UnlockableRecipe[]>;
}

export function useCompendiumRecipeForm({activeProject, setFeedback, setRecipes}: Options) {
  const [recipeName, setRecipeName] = useState('');
  const [recipeCategory, setRecipeCategory] =
    useState<UnlockableRecipe['category']>('food');
  const [recipeMinLevel, setRecipeMinLevel] = useState<number>(1);
  const [recipeRequiredMilestones, setRecipeRequiredMilestones] = useState('');
  const handleCreateRecipe = async () => {
    if (!activeProject || !recipeName.trim()) return;
    const now = Date.now();
    const recipe: UnlockableRecipe = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: recipeName.trim(),
      category: recipeCategory,
      requirements: {
        minCharacterLevel: Math.max(1, Math.floor(recipeMinLevel)),
        requiredMilestoneIds: parseCommaSeparatedIds(recipeRequiredMilestones)
      },
      createdAt: now,
      updatedAt: now
    };
    setFeedback(null);
    try {
      await saveUnlockableRecipe(recipe);
      setRecipes((prev) => [...prev, recipe].sort((a, b) => a.name.localeCompare(b.name)));
      setRecipeName('');
      setRecipeMinLevel(1);
      setRecipeRequiredMilestones('');
      setFeedback({tone: 'success', message: 'Unlockable recipe added.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to save recipe.');
      setFeedback({tone: 'error', message});
    }
  };

  return {
    recipeName,
    setRecipeName,
    recipeCategory,
    setRecipeCategory,
    recipeMinLevel,
    setRecipeMinLevel,
    recipeRequiredMilestones,
    setRecipeRequiredMilestones,
    handleCreateRecipe
  };
}
