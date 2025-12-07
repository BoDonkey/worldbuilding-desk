import React, {useState} from 'react';
import type {StatDefinition} from '@litrpg-tool/rules-engine';

export interface StatEditorProps {
  stat: StatDefinition;
  onUpdate: (updates: Partial<StatDefinition>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  expandable?: boolean;
}

export function StatEditor({
  stat,
  onUpdate,
  onDelete,
  onDuplicate,
  expandable = false
}: StatEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className='stat-editor'>
      <div className='stat-editor-header'>
        {expandable && (
          <button
            className='stat-editor-expand-btn'
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        <input
          type='text'
          value={stat.name}
          onChange={(e) => onUpdate({name: e.target.value})}
          className='stat-editor-name'
          placeholder='Stat name'
        />

        <select
          value={stat.type}
          onChange={(e) =>
            onUpdate({type: e.target.value as 'number' | 'boolean' | 'text'})
          }
          className='stat-editor-type'
        >
          <option value='number'>Number</option>
          <option value='boolean'>Boolean</option>
          <option value='text'>Text</option>
        </select>

        <div className='stat-editor-actions'>
          {onDuplicate && (
            <button onClick={onDuplicate} className='stat-editor-btn-duplicate'>
              Duplicate
            </button>
          )}
          <button onClick={onDelete} className='stat-editor-btn-delete'>
            Delete
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className='stat-editor-details'>
          <div className='stat-editor-field'>
            <label>Description</label>
            <textarea
              value={stat.description || ''}
              onChange={(e) => onUpdate({description: e.target.value})}
              placeholder='What does this stat represent?'
              rows={2}
            />
          </div>

          {stat.type === 'number' && (
            <>
              <div className='stat-editor-field-group'>
                <div className='stat-editor-field'>
                  <label>Minimum Value</label>
                  <input
                    type='number'
                    value={stat.min ?? ''}
                    onChange={(e) =>
                      onUpdate({
                        min: e.target.value ? Number(e.target.value) : undefined
                      })
                    }
                    placeholder='No minimum'
                  />
                </div>

                <div className='stat-editor-field'>
                  <label>Maximum Value</label>
                  <input
                    type='number'
                    value={stat.max ?? ''}
                    onChange={(e) =>
                      onUpdate({
                        max: e.target.value ? Number(e.target.value) : undefined
                      })
                    }
                    placeholder='No maximum'
                  />
                </div>
              </div>

              <div className='stat-editor-field'>
                <label>Default Starting Value</label>
                <input
                  type='number'
                  value={
                    typeof stat.defaultValue === 'number'
                      ? stat.defaultValue
                      : 0
                  }
                  onChange={(e) =>
                    onUpdate({defaultValue: Number(e.target.value)})
                  }
                />
              </div>
            </>
          )}

          {stat.type === 'boolean' && (
            <div className='stat-editor-field'>
              <label>Default Value</label>
              <select
                value={stat.defaultValue ? 'true' : 'false'}
                onChange={(e) =>
                  onUpdate({defaultValue: e.target.value === 'true'})
                }
              >
                <option value='true'>True</option>
                <option value='false'>False</option>
              </select>
            </div>
          )}

          {stat.type === 'text' && (
            <div className='stat-editor-field'>
              <label>Default Value</label>
              <input
                type='text'
                value={
                  typeof stat.defaultValue === 'string' ? stat.defaultValue : ''
                }
                onChange={(e) => onUpdate({defaultValue: e.target.value})}
                placeholder='Default text'
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
