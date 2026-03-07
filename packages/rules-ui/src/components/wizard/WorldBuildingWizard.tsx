import React, {useMemo, useState} from 'react';
import type {
  WorldRuleset,
  StatDefinition,
  ResourceDefinition
} from '@litrpg-tool/rules-engine';
import {createEmptyRuleset} from '@litrpg-tool/rules-engine';
import {StatSystemStep} from './StatSystemStep';
import {ResourceSystemStep} from './ResourceSystemStep';

export interface WorldBuildingWizardProps {
  onComplete: (ruleset: WorldRuleset) => void;
  onCancel?: () => void;
  initialRuleset?: WorldRuleset;
}

interface WizardData {
  name: string;
  description: string;
  stats: StatDefinition[];
  resources: ResourceDefinition[];
}

function buildDataSignature(data: WizardData): string {
  return JSON.stringify({
    name: data.name,
    description: data.description,
    stats: data.stats,
    resources: data.resources
  });
}

export function WorldBuildingWizard({
  onComplete,
  onCancel,
  initialRuleset
}: WorldBuildingWizardProps) {
  const isEditing = Boolean(initialRuleset);
  const initialDraft: WizardData = {
    name: initialRuleset?.name || '',
    description: initialRuleset?.description || '',
    stats: initialRuleset?.statDefinitions || [],
    resources: initialRuleset?.resourceDefinitions || []
  };
  const [draft, setDraft] = useState<WizardData>(initialDraft);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSavedOnce, setHasSavedOnce] = useState(isEditing);
  const [savedSignature, setSavedSignature] = useState(
    buildDataSignature(initialDraft)
  );

  const basicsComplete = draft.name.trim().length > 0;
  const statsComplete = draft.stats.length > 0;
  const resourcesComplete = draft.resources.length > 0;

  const isStatsUnlocked = isEditing || hasSavedOnce || basicsComplete;
  const isResourcesUnlocked =
    isEditing || hasSavedOnce || (basicsComplete && statsComplete);

  const currentSignature = useMemo(() => buildDataSignature(draft), [draft]);
  const hasUnsavedChanges = currentSignature !== savedSignature;
  const canCreate = basicsComplete && statsComplete && resourcesComplete;
  const canSave = hasSavedOnce || isEditing ? hasUnsavedChanges : canCreate;

  const handleSave = async () => {
    if (!canSave || isProcessing) {
      return;
    }

    const baseRuleset =
      initialRuleset || createEmptyRuleset(draft.name.trim() || 'My World');
    const finalRuleset: WorldRuleset = {
      ...baseRuleset,
      name: draft.name,
      description: draft.description,
      statDefinitions: draft.stats,
      resourceDefinitions: draft.resources,
      updatedAt: Date.now()
    };

    setIsProcessing(true);
    try {
      await Promise.resolve(onComplete(finalRuleset));
      setHasSavedOnce(true);
      setSavedSignature(currentSignature);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='world-building-wizard'>
      <div className='wizard-content'>
        <div className='wizard-sections'>
          <div className='wizard-section-card'>
            <BasicsStep
              name={draft.name}
              description={draft.description}
              onChange={(updates) =>
                setDraft((prev) => ({
                  ...prev,
                  ...updates
                }))
              }
            />
          </div>

          <div
            className={`wizard-section-card ${isStatsUnlocked ? '' : 'locked'}`}
            aria-disabled={!isStatsUnlocked}
          >
            <StatSystemStep
              stats={draft.stats}
              onChange={(stats) =>
                setDraft((prev) => ({
                  ...prev,
                  stats
                }))
              }
            />
            {!isStatsUnlocked && (
              <p className='section-lock-hint'>
                Complete World Basics to unlock Character Stats.
              </p>
            )}
          </div>

          <div
            className={`wizard-section-card ${
              isResourcesUnlocked ? '' : 'locked'
            }`}
            aria-disabled={!isResourcesUnlocked}
          >
            <ResourceSystemStep
              resources={draft.resources}
              onChange={(resources) =>
                setDraft((prev) => ({
                  ...prev,
                  resources
                }))
              }
            />
            {!isResourcesUnlocked && (
              <p className='section-lock-hint'>
                Add at least one stat to unlock Resources.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className='wizard-navigation'>
        <div className='wizard-nav-left'>
          {onCancel && (
            <button onClick={onCancel} className='btn-ghost'>
              Cancel
            </button>
          )}
        </div>

        <div className='wizard-nav-right'>
          <button
            onClick={handleSave}
            className='btn-primary'
            disabled={!canSave || isProcessing}
          >
            {isProcessing
              ? 'Processing...'
              : hasSavedOnce || isEditing
                ? 'Save Changes'
                : 'Create World'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// Basics step component
interface BasicsStepProps {
  name: string;
  description: string;
  onChange: (updates: {name?: string; description?: string}) => void;
}

function BasicsStep({name, description, onChange}: BasicsStepProps) {
  return (
    <div className='basics-step'>
      <div className='step-header'>
        <h2>World Basics</h2>
        <p>Give your world a name and description</p>
      </div>

      <div className='basics-form'>
        <div className='form-field'>
          <label htmlFor='world-name'>World Name *</label>
          <input
            id='world-name'
            type='text'
            value={name}
            onChange={(e) => onChange({name: e.target.value})}
            placeholder='My Epic Fantasy World'
            className='form-input-large'
            autoFocus
          />
        </div>

        <div className='form-field'>
          <label htmlFor='world-description'>Description (Optional)</label>
          <textarea
            id='world-description'
            value={description}
            onChange={(e) => onChange({description: e.target.value})}
            placeholder='A world of magic and adventure where heroes rise to face ancient evils...'
            rows={4}
            className='form-textarea'
          />
        </div>

        <div className='form-hint'>
          <p>
            You can always change these later. The name helps you identify this
            world in your project.
          </p>
        </div>
      </div>
    </div>
  );
}
