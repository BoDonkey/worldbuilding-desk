import {describe, expect, it} from 'vitest';
import type {LoreInspectorRecord} from '../../components/Editor/LoreInspectorPanel';
import {
  buildWorkspaceLoreConsultation,
  summarizeWorkspaceContent,
  type WorkspaceLoreConsultationMode
} from './workspaceConsultation';

const record = {
  name: 'Mira',
  type: 'character',
  vitalSigns: ['Level 2', 'Health 10/10'],
  synopsis: {
    goal: 'Reach the citadel',
    recentEvent: 'Crossed the pass',
    motivation: 'Protect the caravan'
  }
} as LoreInspectorRecord;

describe('summarizeWorkspaceContent', () => {
  it('normalizes rich text and applies the requested limit', () => {
    expect(summarizeWorkspaceContent('<p>One&nbsp; two</p><p>Three</p>', 9))
      .toBe('One two T');
  });
});

describe('buildWorkspaceLoreConsultation', () => {
  const expectedGuides: Record<WorkspaceLoreConsultationMode, string> = {
    consistency: 'confirmed facts',
    reaction: '3 plausible reactions',
    outcome: 'one likely outcome',
    worldbuilding: 'Social/Cultural',
    plotting: '4 plot hooks'
  };

  Object.entries(expectedGuides).forEach(([mode, guide]) => {
    it(`builds the ${mode} prompt with its mode-specific output contract`, () => {
      const result = buildWorkspaceLoreConsultation({
        mode: mode as WorkspaceLoreConsultationMode,
        record,
        content: '<p>The caravan reaches the northern gate.</p>',
        maxContextChars: 12
      });

      expect(result.compactContext).toBe('The caravan ');
      expect(result.prompt).toContain('Subject: Mira (character)');
      expect(result.prompt).toContain(guide);
      expect(result.prompt).toContain('Flag any assumption');
    });
  });
});
