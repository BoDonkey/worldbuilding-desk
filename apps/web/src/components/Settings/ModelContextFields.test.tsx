import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {ModelContextFields} from './ModelContextFields';

const settings = {provider: 'ollama', configs: {}, promptTools: [], defaultToolIds: []} as ProjectAISettings;

describe('ModelContextFields', () => {
  it('turns linked World Bible records on for the project, off by default', () => {
    const onSettingsChange = vi.fn();
    render(<ModelContextFields aiSettings={settings} consultationEnabled onSettingsChange={onSettingsChange} />);
    const box = screen.getByLabelText('Include linked World Bible records');
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(onSettingsChange).toHaveBeenCalledWith({...settings, includeLinkedRecords: true});
  });

  it('keeps scene drafts off while AI consultation is off', () => {
    render(
      <ModelContextFields aiSettings={{...settings, allowSceneDrafts: true}} consultationEnabled={false} onSettingsChange={vi.fn()} />
    );
    expect(screen.getByLabelText('Allow AI scene drafts')).not.toBeChecked();
    expect(screen.getByLabelText('Allow AI scene drafts')).toBeDisabled();
  });
});
