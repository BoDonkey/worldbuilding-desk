import React, {useState} from 'react';
import type {ResourceDefinition} from '@litrpg-tool/rules-engine';
import {RESOURCE_SYSTEM_PRESETS} from '@litrpg-tool/rules-engine';
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
      id: 'basic',
      name: 'Health Only',
      description: 'Simple health tracking',
      preview: <div className='template-preview'>Health</div>,
      data: RESOURCE_SYSTEM_PRESETS.basic
    },
    {
      id: 'mana',
      name: 'Health + Mana',
      description: 'Standard RPG resources',
      preview: <div className='template-preview'>Health • Mana</div>,
      data: RESOURCE_SYSTEM_PRESETS.mana
    },
    {
      id: 'stamina',
      name: 'Health + Mana + Stamina',
      description: 'Full resource management',
      preview: <div className='template-preview'>Health • Mana • Stamina</div>,
      data: RESOURCE_SYSTEM_PRESETS.stamina
    },
    {
      id: 'none',
      name: 'No Resources',
      description: 'Pure narrative focus with no resource tracking',
      data: []
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

  return (
    <div className='resource-system-step'>
      <div className='step-header'>
        <h2>Resources</h2>
        <p>
          Define trackable resources like health, mana, stamina, or custom pools
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

                    <button
                      onClick={() => handleDeleteResource(index)}
                      className='resource-editor-btn-delete'
                    >
                      Delete
                    </button>
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
                      <label>Maximum</label>
                      <input
                        type='number'
                        value={resource.max ?? 100}
                        onChange={(e) =>
                          handleUpdateResource(index, {
                            max: e.target.value
                              ? Number(e.target.value)
                              : undefined
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className='resource-editor-regeneration'>
                    <label>
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
                      Enable Regeneration
                    </label>

                    {resource.regeneration?.enabled && (
                      <div className='resource-editor-regen-fields'>
                        <div className='resource-editor-field'>
                          <label>Rate (per interval)</label>
                          <input
                            type='number'
                            value={resource.regeneration.rate}
                            onChange={(e) =>
                              handleUpdateResource(index, {
                                regeneration: {
                                  ...resource.regeneration!,
                                  rate: Number(e.target.value)
                                }
                              })
                            }
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
                                  ...resource.regeneration!,
                                  interval: Number(e.target.value)
                                }
                              })
                            }
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
