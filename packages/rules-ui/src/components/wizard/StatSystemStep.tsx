import React, {useState} from 'react';
import type {StatDefinition} from '@litrpg-tool/rules-engine';
import {STAT_SYSTEM_PRESETS} from '@litrpg-tool/rules-engine';
import {StatEditor} from '../shared/StatEditor';
import {TemplateSelector, type Template} from '../shared/TemplateSelector';

export interface StatSystemStepProps {
  stats: StatDefinition[];
  onChange: (stats: StatDefinition[]) => void;
}

export function StatSystemStep({stats, onChange}: StatSystemStepProps) {
  const [showTemplates, setShowTemplates] = useState(stats.length === 0);
  const [expandAll, setExpandAll] = useState(false);

  const templates: Template<StatDefinition[]>[] = [
    {
      id: 'dnd',
      name: 'D&D Classic',
      description: 'Six classic D&D attributes (STR, DEX, CON, INT, WIS, CHA)',
      preview: (
        <div className='template-preview'>
          STR • DEX • CON • INT • WIS • CHA
        </div>
      ),
      data: STAT_SYSTEM_PRESETS.dnd
    },
    {
      id: 'litrpg',
      name: 'LitRPG Standard',
      description: 'Common LitRPG stats (STR, AGI, VIT, INT, WIS, LUK)',
      preview: (
        <div className='template-preview'>
          STR • AGI • VIT • INT • WIS • LUK
        </div>
      ),
      data: STAT_SYSTEM_PRESETS.litrpg
    },
    {
      id: 'simple',
      name: 'Simple (3 Stats)',
      description:
        'Streamlined system with just Strength, Agility, Intelligence',
      preview: (
        <div className='template-preview'>
          Strength • Agility • Intelligence
        </div>
      ),
      data: STAT_SYSTEM_PRESETS.simple
    },
    {
      id: 'cultivation',
      name: 'Cultivation Novel',
      description:
        'Eastern cultivation stats (Qi, Comprehension, Spirit Root, Realm)',
      preview: (
        <div className='template-preview'>
          Qi • Comprehension • Spirit Root • Realm
        </div>
      ),
      data: STAT_SYSTEM_PRESETS.cultivation
    },
    {
      id: 'blank',
      name: 'Blank Slate',
      description: 'Start from scratch with no predefined stats',
      data: []
    }
  ];

  const handleTemplateSelect = (template: Template<StatDefinition[]>) => {
    onChange([...template.data]);
    setShowTemplates(false);
  };

  const handleAddStat = () => {
    const newStat: StatDefinition = {
      id: `stat_${Date.now()}`,
      name: `New Stat ${stats.length + 1}`,
      type: 'number',
      defaultValue: 10,
      min: 1
    };
    onChange([...stats, newStat]);
  };

  const handleUpdateStat = (
    index: number,
    updates: Partial<StatDefinition>
  ) => {
    const updated = [...stats];
    updated[index] = {...updated[index], ...updates};
    onChange(updated);
  };

  const handleDeleteStat = (index: number) => {
    onChange(stats.filter((_, i) => i !== index));
  };

  const handleDuplicateStat = (index: number) => {
    const statToDuplicate = stats[index];
    const newStat: StatDefinition = {
      ...statToDuplicate,
      id: `stat_${Date.now()}`,
      name: `${statToDuplicate.name} (Copy)`
    };
    onChange([...stats, newStat]);
  };

  return (
    <div className='stat-system-step'>
      <div className='step-header'>
        <h2>Character Stats</h2>
        <p>Define what attributes characters in your world will have</p>
      </div>

      {showTemplates ? (
        <div className='template-section'>
          <h3>Choose a Starting Point</h3>
          <TemplateSelector
            templates={templates}
            onSelect={handleTemplateSelect}
            onCustomize={handleTemplateSelect}
          />
        </div>
      ) : (
        <div className='stats-editor-section'>
          <div className='stats-editor-toolbar'>
            <button
              onClick={() => setShowTemplates(true)}
              className='btn-secondary'
            >
              Load Template
            </button>

            <button onClick={handleAddStat} className='btn-primary'>
              + Add Stat
            </button>

            {stats.length > 0 && (
              <button
                onClick={() => setExpandAll(!expandAll)}
                className='btn-ghost'
              >
                {expandAll ? 'Collapse All' : 'Expand All'}
              </button>
            )}
          </div>

          {stats.length === 0 ? (
            <div className='empty-state'>
              <p>
                No stats defined yet. Add your first stat or choose a template.
              </p>
            </div>
          ) : (
            <div className='stats-list'>
              {stats.map((stat, index) => (
                <StatEditor
                  key={stat.id}
                  stat={stat}
                  onUpdate={(updates) => handleUpdateStat(index, updates)}
                  onDelete={() => handleDeleteStat(index)}
                  onDuplicate={() => handleDuplicateStat(index)}
                  expandable={true}
                />
              ))}
            </div>
          )}

          {stats.length > 0 && (
            <div className='stats-summary'>
              <strong>{stats.length}</strong> stat
              {stats.length !== 1 ? 's' : ''} defined
            </div>
          )}
        </div>
      )}
    </div>
  );
}
