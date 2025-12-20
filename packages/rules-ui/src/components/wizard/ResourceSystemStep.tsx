import React, {useState} from 'react';
import type {ResourceDefinition} from '@litrpg-tool/rules-engine';
import {TemplateSelector, type Template} from '../shared/TemplateSelector';

export interface ResourceSystemStepProps {
  resources: ResourceDefinition[];
  onChange: (resources: ResourceDefinition[]) => void;
}

export function ResourceSystemStep({
  resources,
  onChange
}: ResourceSystemStepProps) {
  const [showTemplates, setShowTemplates] = useState(resources.length === 0);

  const templates: Template<ResourceDefinition[]>[] = [
    {
      id: 'custom',
      name: 'Custom (Start from Scratch)',
      description: 'Define your own resources from the ground up',
      preview: <div className='template-preview'>Build your own system</div>,
      data: []
    },
    {
      id: 'basic',
      name: 'Health Only',
      description: 'Simple health tracking',
      preview: <div className='template-preview'>Health</div>,
      data: [
        {
          id: 'health',
          name: 'Health',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: false, rate: 0, interval: 0}
        }
      ]
    },
    {
      id: 'standard',
      name: 'Standard RPG',
      description: 'Health, Mana, and Stamina',
      preview: <div className='template-preview'>Health • Mana • Stamina</div>,
      data: [
        {
          id: 'health',
          name: 'Health',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: false, rate: 0, interval: 0}
        },
        {
          id: 'mana',
          name: 'Mana',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: true, rate: 5, interval: 1}
        },
        {
          id: 'stamina',
          name: 'Stamina',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: true, rate: 10, interval: 1}
        }
      ]
    },
    {
      id: 'cultivation',
      name: 'Cultivation Novel',
      description: 'Qi energy pool, Spirit power, and Health',
      preview: (
        <div className='template-preview'>Qi Energy • Spirit • Health</div>
      ),
      data: [
        {
          id: 'qi_energy',
          name: 'Qi Energy',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: true, rate: 2, interval: 1}
        },
        {
          id: 'spirit_power',
          name: 'Spirit Power',
          type: 'number',
          defaultValue: 50,
          min: 0,
          max: 50,
          regeneration: {enabled: true, rate: 1, interval: 2}
        },
        {
          id: 'health',
          name: 'Health',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: false, rate: 0, interval: 0}
        }
      ]
    },
    {
      id: 'scifi',
      name: 'Sci-Fi',
      description: 'Shields, Energy, and Hull Integrity',
      preview: <div className='template-preview'>Shields • Energy • Hull</div>,
      data: [
        {
          id: 'shields',
          name: 'Shields',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: true, rate: 5, interval: 1}
        },
        {
          id: 'energy',
          name: 'Energy',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: true, rate: 3, interval: 1}
        },
        {
          id: 'hull',
          name: 'Hull Integrity',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          regeneration: {enabled: false, rate: 0, interval: 0}
        }
      ]
    }
  ];

  const handleTemplateSelect = (template: Template<ResourceDefinition[]>) => {
    onChange([...template.data]);
    setShowTemplates(false);
  };

  const handleAddResource = () => {
    const newResource: ResourceDefinition = {
      id: `resource_${Date.now()}`,
      name: `Resource ${resources.length + 1}`,
      type: 'number',
      defaultValue: 100,
      min: 0,
      max: 100,
      regeneration: {
        enabled: false,
        rate: 1,
        interval: 60
      }
    };
    onChange([...resources, newResource]);
  };

  const handleUpdateResource = (
    index: number,
    updates: Partial<ResourceDefinition>
  ) => {
    const updated = [...resources];
    updated[index] = {...updated[index], ...updates};
    onChange(updated);
  };

  const handleDeleteResource = (index: number) => {
    onChange(resources.filter((_, i) => i !== index));
  };

  const handleDuplicateResource = (index: number) => {
    const resourceToDuplicate = resources[index];
    const newResource: ResourceDefinition = {
      ...resourceToDuplicate,
      id: `resource_${Date.now()}`,
      name: `${resourceToDuplicate.name} (Copy)`
    };
    onChange([...resources, newResource]);
  };

  return (
    <div className='resource-system-step'>
      <div className='step-header'>
        <h2>Resources</h2>
        <p>
          Define trackable resources like health, mana, qi energy, or custom
          pools
        </p>
      </div>

      {showTemplates ? (
        <div className='template-section'>
          <h3>Choose a Resource System</h3>
          <TemplateSelector
            templates={templates}
            onSelect={handleTemplateSelect}
            onCustomize={handleTemplateSelect}
          />
        </div>
      ) : (
        <div className='resources-editor-section'>
          <div className='resources-editor-toolbar'>
            <button
              onClick={() => setShowTemplates(true)}
              className='btn-secondary'
            >
              Load Template
            </button>

            <button onClick={handleAddResource} className='btn-primary'>
              + Add Resource
            </button>
          </div>

          {resources.length === 0 ? (
            <div className='empty-state'>
              <p>No resources defined. Add a resource or choose a template.</p>
            </div>
          ) : (
            <div className='resources-list'>
              {resources.map((resource, index) => (
                <div key={resource.id} className='resource-editor'>
                  <div className='resource-editor-header'>
                    <input
                      type='text'
                      value={resource.name}
                      onChange={(e) =>
                        handleUpdateResource(index, {name: e.target.value})
                      }
                      className='resource-editor-name'
                      placeholder='Resource name'
                    />

                    <div className='resource-editor-actions'>
                      <button
                        onClick={() => handleDuplicateResource(index)}
                        className='resource-editor-btn-duplicate'
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDeleteResource(index)}
                        className='resource-editor-btn-delete'
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className='resource-editor-fields'>
                    <div className='resource-editor-field'>
                      <label>Default Value</label>
                      <input
                        type='number'
                        value={
                          typeof resource.defaultValue === 'number'
                            ? resource.defaultValue
                            : 100
                        }
                        onChange={(e) =>
                          handleUpdateResource(index, {
                            defaultValue: Number(e.target.value)
                          })
                        }
                      />
                    </div>

                    <div className='resource-editor-field'>
                      <label>Minimum</label>
                      <input
                        type='number'
                        value={resource.min ?? 0}
                        onChange={(e) =>
                          handleUpdateResource(index, {
                            min: Number(e.target.value)
                          })
                        }
                      />
                    </div>

                    <div className='resource-editor-field'>
                      <label>Maximum</label>
                      <input
                        type='number'
                        value={resource.max ?? 100}
                        onChange={(e) =>
                          handleUpdateResource(index, {
                            max: Number(e.target.value)
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Regeneration settings */}
                  <div className='resource-editor-regen'>
                    <label className='resource-editor-regen-toggle'>
                      <input
                        type='checkbox'
                        checked={resource.regeneration?.enabled ?? false}
                        onChange={(e) =>
                          handleUpdateResource(index, {
                            regeneration: {
                              enabled: e.target.checked,
                              rate: resource.regeneration?.rate ?? 1,
                              interval: resource.regeneration?.interval ?? 60
                            }
                          })
                        }
                      />
                      <span>Enable Regeneration</span>
                    </label>

                    {resource.regeneration?.enabled && (
                      <div className='resource-editor-regen-fields'>
                        <div className='resource-editor-field'>
                          <label>Regen Rate (per interval)</label>
                          <input
                            type='number'
                            value={resource.regeneration.rate}
                            onChange={(e) =>
                              handleUpdateResource(index, {
                                regeneration: {
                                  enabled:
                                    resource.regeneration?.enabled ?? false,
                                  rate: Number(e.target.value),
                                  interval:
                                    resource.regeneration?.interval ?? 60
                                }
                              })
                            }
                            min={0}
                          />
                        </div>

                        <div className='resource-editor-field'>
                          <label>Interval (seconds)</label>
                          <input
                            type='number'
                            value={resource.regeneration.interval}
                            onChange={(e) =>
                              handleUpdateResource(index, {
                                regeneration: {
                                  enabled:
                                    resource.regeneration?.enabled ?? false,
                                  rate: resource.regeneration?.rate ?? 1,
                                  interval: Number(e.target.value)
                                }
                              })
                            }
                            min={1}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {resources.length > 0 && (
            <div className='resources-summary'>
              <strong>{resources.length}</strong> resource
              {resources.length !== 1 ? 's' : ''} defined
            </div>
          )}
        </div>
      )}
    </div>
  );
}
