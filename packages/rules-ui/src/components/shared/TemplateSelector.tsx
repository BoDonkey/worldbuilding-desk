import React from 'react';

export interface Template<T = any> {
  id: string;
  name: string;
  description: string;
  preview?: React.ReactNode;
  data: T;
}

export interface TemplateSelectorProps<T = any> {
  templates: Template<T>[];
  onSelect: (template: Template<T>) => void;
  onCustomize?: (template: Template<T>) => void;
  selectedId?: string;
}

export function TemplateSelector<T = any>({
  templates,
  onSelect,
  onCustomize,
  selectedId
}: TemplateSelectorProps<T>) {
  return (
    <div className='template-selector'>
      <div className='template-grid'>
        {templates.map((template) => (
          <div
            key={template.id}
            className={`template-card ${
              selectedId === template.id ? 'selected' : ''
            }`}
          >
            <div className='template-card-header'>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
            </div>

            {template.preview && (
              <div className='template-card-preview'>{template.preview}</div>
            )}

            <div className='template-card-actions'>
              <button
                onClick={() => onSelect(template)}
                className='template-btn-select'
              >
                Use This
              </button>
              {onCustomize && (
                <button
                  onClick={() => onCustomize(template)}
                  className='template-btn-customize'
                >
                  Customize
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
