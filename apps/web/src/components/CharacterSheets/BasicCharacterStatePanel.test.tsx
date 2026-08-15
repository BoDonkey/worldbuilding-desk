import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {BasicCharacterStatePanel} from './BasicCharacterStatePanel';

describe('BasicCharacterStatePanel', () => {
  it('uses plain change labels and requires explicit confirmation', () => {
    const onConfirm = vi.fn();
    render(<BasicCharacterStatePanel
      sheets={[{id: 'sheet-1', projectId: 'p', characterEntityId: 'mira', name: 'Mira', level: 1, experience: 0, stats: [{definitionId: 'resolve', value: 5}], resources: [], inventory: [], createdAt: 1, updatedAt: 1}]}
      ruleset={{id: 'rules', projectId: 'p', name: 'Rules', version: '1', description: '', statDefinitions: [{id: 'resolve', name: 'Resolve', type: 'number', defaultValue: 5}], resourceDefinitions: [], rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1}}
      documents={[{id: 'scene-1', projectId: 'p', title: 'The Gate', content: '', createdAt: 1, updatedAt: 1}]}
      sheetId='sheet-1' sceneId='scene-1' mutationType='stat_change'
      statDefinitionId='resolve' resourceDefinitionId='' numberValue='2'
      previewSummary='Resolve: 5 → 7' previewIssues={[]} feedback={null} isSaving={false}
      onSheetChange={vi.fn()} onSceneChange={vi.fn()} onTrackedValueChange={vi.fn()}
      onOperationChange={vi.fn()} onNumberValueChange={vi.fn()} onConfirm={onConfirm}
      onOpenAdvanced={vi.fn()} onOpenWorldBible={vi.fn()}
    />);
    expect(screen.getByRole('option', {name: 'Change by'})).toBeInTheDocument();
    expect(screen.getByText('Resolve: 5 → 7')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Confirm scene change'}));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
