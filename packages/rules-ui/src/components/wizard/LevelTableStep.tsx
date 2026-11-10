import React from 'react';
import type {LevelThreshold} from '@worldbuilding-desk/rules-engine';

export interface LevelTableStepProps {
  levelTable: LevelThreshold[];
  onChange: (levelTable: LevelThreshold[]) => void;
}

/** Optional XP thresholds: reaching a row's XP total raises a character to that level. */
export function LevelTableStep({levelTable, onChange}: LevelTableStepProps) {
  const handleAdd = () => {
    const last = levelTable[levelTable.length - 1];
    onChange([
      ...levelTable,
      last
        ? {level: last.level + 1, experience: last.experience + 100}
        : {level: 2, experience: 100}
    ]);
  };

  const handleUpdate = (index: number, updates: Partial<LevelThreshold>) => {
    onChange(levelTable.map((row, i) => (i === index ? {...row, ...updates} : row)));
  };

  return (
    <div className='level-table-step'>
      <div className='step-header'>
        <h2>Levels (Optional)</h2>
        <p>
          Set the total XP each level needs. When a scene records an XP gain, later
          scenes show the level it reaches. Without a table, each character keeps the
          level set on their sheet.
        </p>
      </div>

      <div className='resources-editor-section'>
        <div className='resources-editor-toolbar'>
          <button onClick={handleAdd} className='btn-primary'>
            + Add Level
          </button>
        </div>

        {levelTable.length === 0 ? (
          <div className='empty-state'>
            <p>No level table. Characters start at level 1, so the first row is usually level 2.</p>
          </div>
        ) : (
          <div className='resources-list'>
            {levelTable.map((row, index) => (
              <div key={index} className='resource-editor'>
                <div className='resource-editor-fields'>
                  <div className='resource-editor-field'>
                    <label htmlFor={`level-table-level-${index}`}>Level</label>
                    <input
                      id={`level-table-level-${index}`}
                      type='number'
                      min={2}
                      step={1}
                      value={row.level}
                      onChange={(e) => handleUpdate(index, {level: Number(e.target.value)})}
                    />
                  </div>
                  <div className='resource-editor-field'>
                    <label htmlFor={`level-table-xp-${index}`}>Total XP needed</label>
                    <input
                      id={`level-table-xp-${index}`}
                      type='number'
                      min={0}
                      value={row.experience}
                      onChange={(e) =>
                        handleUpdate(index, {experience: Number(e.target.value)})
                      }
                    />
                  </div>
                </div>
                <button
                  onClick={() => onChange(levelTable.filter((_, i) => i !== index))}
                  className='resource-editor-btn-delete'
                  aria-label={`Remove level ${row.level}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
