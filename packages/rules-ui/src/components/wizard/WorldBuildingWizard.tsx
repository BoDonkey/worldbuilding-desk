import React, {useState} from 'react';
import type {
  WorldRuleset,
  StatDefinition,
  ResourceDefinition
} from '@litrpg-tool/rules-engine';
import {createEmptyRuleset} from '@litrpg-tool/rules-engine';
import {useWizard} from '../../hooks/useWizard';
import {StatSystemStep} from './StatSystemStep';
import {ResourceSystemStep} from './ResourceSystemStep';
import {ReviewStep} from './ReviewStep';

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

export function WorldBuildingWizard({
  onComplete,
  onCancel,
  initialRuleset
}: WorldBuildingWizardProps) {
  const [ruleset, setRuleset] = useState<WorldRuleset>(
    initialRuleset || createEmptyRuleset('My World')
  );

  const steps = [
    {
      id: 'basics',
      title: 'World Basics',
      description: 'Name and describe your world',
      component: BasicsStep,
      isComplete: (data: WizardData) => data.name.trim().length > 0
    },
    {
      id: 'stats',
      title: 'Character Stats',
      description: 'Define character attributes',
      component: StatSystemStep,
      isComplete: () => true // Optional step
    },
    {
      id: 'resources',
      title: 'Resources',
      description: 'Define trackable resources',
      component: ResourceSystemStep,
      isComplete: () => true // Optional step
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Review and confirm',
      component: ReviewStep,
      isComplete: () => true
    }
  ];

  const wizard = useWizard({
    steps,
    initialData: {
      name: ruleset.name,
      description: ruleset.description || '',
      stats: ruleset.statDefinitions,
      resources: ruleset.resourceDefinitions
    },
    onComplete: (data: WizardData) => {
      const finalRuleset: WorldRuleset = {
        ...ruleset,
        name: data.name,
        description: data.description,
        statDefinitions: data.stats,
        resourceDefinitions: data.resources,
        updatedAt: Date.now()
      };
      onComplete(finalRuleset);
    }
  });

  const CurrentStepComponent = wizard.currentStep.component;

  // Update ruleset when wizard data changes
  React.useEffect(() => {
    setRuleset((prev: WorldRuleset) => ({
      ...prev,
      name: wizard.wizardData.name,
      description: wizard.wizardData.description,
      statDefinitions: wizard.wizardData.stats,
      resourceDefinitions: wizard.wizardData.resources
    }));
  }, [wizard.wizardData]);

  return (
    <div className='world-building-wizard'>
      {/* Progress indicator */}
      <div className='wizard-progress'>
        <div className='wizard-progress-bar'>
          <div
            className='wizard-progress-fill'
            style={{
              width: `${
                ((wizard.currentStepIndex + 1) / wizard.totalSteps) * 100
              }%`
            }}
          />
        </div>
        <div className='wizard-steps'>
          {steps.map((step, index) => (
            <button
              key={step.id}
              className={`wizard-step-indicator ${
                index === wizard.currentStepIndex ? 'active' : ''
              } ${index < wizard.currentStepIndex ? 'completed' : ''}`}
              onClick={() => wizard.goToStep(index)}
              disabled={index > wizard.currentStepIndex}
            >
              <span className='wizard-step-number'>{index + 1}</span>
              <span className='wizard-step-title'>{step.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className='wizard-content'>
        {wizard.currentStep.id === 'basics' && (
          <BasicsStep
            name={wizard.wizardData.name}
            description={wizard.wizardData.description}
            onChange={(updates) => wizard.updateData(updates)}
          />
        )}

        {wizard.currentStep.id === 'stats' && (
          <StatSystemStep
            stats={wizard.wizardData.stats}
            onChange={(stats) => wizard.updateData({stats})}
          />
        )}

        {wizard.currentStep.id === 'resources' && (
          <ResourceSystemStep
            resources={wizard.wizardData.resources}
            onChange={(resources) => wizard.updateData({resources})}
          />
        )}

        {wizard.currentStep.id === 'review' && (
          <ReviewStep
            ruleset={ruleset}
            onEdit={(stepIndex) => wizard.goToStep(stepIndex)}
          />
        )}
      </div>

      {/* Navigation */}
      <div className='wizard-navigation'>
        <div className='wizard-nav-left'>
          {onCancel && (
            <button onClick={onCancel} className='btn-ghost'>
              Cancel
            </button>
          )}
        </div>

        <div className='wizard-nav-right'>
          {!wizard.isFirstStep && (
            <button
              onClick={wizard.goBack}
              className='btn-secondary'
              disabled={wizard.isProcessing}
            >
              Back
            </button>
          )}

          <button
            onClick={wizard.goNext}
            className='btn-primary'
            disabled={!wizard.canGoNext || wizard.isProcessing}
          >
            {wizard.isProcessing
              ? 'Processing...'
              : wizard.isLastStep
              ? 'Create World'
              : 'Next'}
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
