import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {AISettings} from './AISettings';

const settings: ProjectAISettings = {
  provider: 'openai',
  configs: {openai: {model: 'gpt-4o-mini'}},
  promptTools: [],
  defaultToolIds: [],
  inspectorSettings: {
    enableAIConsultation: true,
    reviewEngineMode: 'deterministic',
    canonDecisionProviderMode: 'project-provider',
    maxConsultationsPerDay: 20,
    maxContextChars: 1800,
    maxResponseTokens: 500,
    lowCostModel: ''
  }
};

describe('AISettings hosted response ceiling', () => {
  it('states the response-only maximum charge and structured-reply floor', () => {
    render(
      <AISettings
        aiSettings={settings}
        projectId='project-1'
        projectMode='general'
        onSettingsChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', {name: 'Show advanced settings'}));
    expect(screen.getByTestId('hosted-response-cost-ceiling')).toHaveTextContent(
      'up to 1,500 tokens ($0.01 maximum response charge for gpt-4o-mini)'
    );
    expect(screen.getByTestId('hosted-response-cost-ceiling')).toHaveTextContent(
      'Input tokens cost extra'
    );
  });
});
