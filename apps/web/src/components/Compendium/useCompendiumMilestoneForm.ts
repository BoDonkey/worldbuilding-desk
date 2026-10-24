import {useState} from 'react';
import type {CompendiumMilestone} from '../../entityTypes';
import {saveCompendiumMilestone} from '../../services/storage';
import {parseCommaSeparatedIds} from '../../services/compendium/compendiumFormValues';
import {describeError} from '../../services/errors';
import type {CompendiumFormContext, SetFormValue} from './formTypes';

interface Options extends CompendiumFormContext {
  setMilestones: SetFormValue<CompendiumMilestone[]>;
}

export function useCompendiumMilestoneForm({activeProject, setFeedback, setMilestones}: Options) {
  const [milestoneName, setMilestoneName] = useState('');
  const [milestonePoints, setMilestonePoints] = useState(10);
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneRecipeIds, setMilestoneRecipeIds] = useState('');
  const handleCreateMilestone = async () => {
    if (!activeProject || !milestoneName.trim()) return;
    const recipeIds = parseCommaSeparatedIds(milestoneRecipeIds);
    const milestone: CompendiumMilestone = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: milestoneName.trim(),
      description: milestoneDescription.trim() || undefined,
      pointsRequired: Math.max(0, Math.floor(milestonePoints)),
      unlockRecipeIds: recipeIds,
      permanentEffects: [],
      createdAt: Date.now()
    };
    setFeedback(null);
    try {
      await saveCompendiumMilestone(milestone);
      setMilestones((prev) =>
        [...prev, milestone].sort((a, b) => a.pointsRequired - b.pointsRequired)
      );
      setMilestoneName('');
      setMilestoneDescription('');
      setMilestonePoints(10);
      setMilestoneRecipeIds('');
      setFeedback({tone: 'success', message: 'Milestone added.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to save milestone.');
      setFeedback({tone: 'error', message});
    }
  };

  return {
    milestoneName,
    setMilestoneName,
    milestonePoints,
    setMilestonePoints,
    milestoneDescription,
    setMilestoneDescription,
    milestoneRecipeIds,
    setMilestoneRecipeIds,
    handleCreateMilestone
  };
}
