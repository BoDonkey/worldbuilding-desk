import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
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
    expect(screen.getByText('OpenAI API Key (GPT & embeddings)')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'platform.openai.com'})).toHaveAttribute('href', 'https://platform.openai.com');
  });
});

describe('AISettings local model server', () => {
  const localSettings: ProjectAISettings = {
    ...settings,
    provider: 'local-openai',
    configs: {'local-openai': {baseUrl: 'http://localhost:1234/v1', model: 'qwen3'}}
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for a server address instead of a key and discloses the route as local', () => {
    const onSettingsChange = vi.fn();
    render(<AISettings aiSettings={localSettings} projectId='project-1' projectMode='general' onSettingsChange={onSettingsChange} />);

    expect(screen.getByRole('option', {name: 'Local server (OpenAI-compatible)'})).toBeInTheDocument();
    expect(screen.getByText(/Your local model server runs entirely on your device with "qwen3"/)).toBeInTheDocument();
    expect(screen.queryByText(/API Key/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save API Keys'})).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Server address'), {target: {value: 'http://127.0.0.1:8080/v1'}});
    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({configs: {'local-openai': {baseUrl: 'http://127.0.0.1:8080/v1', model: 'qwen3'}}})
    );

    fireEvent.click(screen.getByRole('button', {name: 'Show advanced settings'}));
    expect(screen.queryByTestId('hosted-response-cost-ceiling')).not.toBeInTheDocument();
    expect(
      screen.getByText("Local replies have no provider charge and do not use this cap; the local model's context size sets their length.")
    ).toBeInTheDocument();
  });

  it('keeps Maximum reply length in advanced settings, blank meaning the server default (4.75)', () => {
    const onSettingsChange = vi.fn();
    render(<AISettings aiSettings={localSettings} projectId='project-1' projectMode='general' onSettingsChange={onSettingsChange} />);
    expect(screen.queryByLabelText('Maximum reply length (tokens)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Show advanced settings'}));
    const field = screen.getByLabelText('Maximum reply length (tokens)');
    expect(field).toHaveValue(null);
    expect(screen.getByText(/KoboldCPP and the llama\.cpp server report their context size/)).toBeInTheDocument();

    fireEvent.change(field, {target: {value: '4096'}});
    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({configs: {'local-openai': {baseUrl: 'http://localhost:1234/v1', model: 'qwen3', maxReplyTokens: 4096}}})
    );
  });

  it('clears Maximum reply length back to the server default', () => {
    const onSettingsChange = vi.fn();
    const withLength = {...localSettings, configs: {'local-openai': {...localSettings.configs['local-openai'], maxReplyTokens: 4096}}};
    render(<AISettings aiSettings={withLength} projectId='project-1' projectMode='general' onSettingsChange={onSettingsChange} />);
    fireEvent.click(screen.getByRole('button', {name: 'Show advanced settings'}));
    const field = screen.getByLabelText('Maximum reply length (tokens)');
    expect(field).toHaveValue(4096);
    fireEvent.change(field, {target: {value: ''}});
    expect(onSettingsChange.mock.lastCall?.[0].configs['local-openai'].maxReplyTokens).toBeUndefined();
  });

  it('shows Maximum reply length only for the local model server', () => {
    render(<AISettings aiSettings={{...settings, provider: 'ollama'}} projectId='project-1' projectMode='general' onSettingsChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', {name: 'Show advanced settings'}));
    expect(screen.queryByLabelText('Maximum reply length (tokens)')).not.toBeInTheDocument();
  });

  it('tests the connection and offers the listed models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/models')
          ? new Response(JSON.stringify({data: [{id: 'qwen3'}, {id: 'mistral-7b'}]}))
          : new Response(JSON.stringify({choices: [{message: {content: 'OK'}, finish_reason: 'stop'}]}))
      )
    );
    const onSettingsChange = vi.fn();
    render(<AISettings aiSettings={localSettings} projectId='project-1' projectMode='general' onSettingsChange={onSettingsChange} />);

    fireEvent.click(screen.getByRole('button', {name: 'Test connection'}));
    expect(await screen.findByText('Local model server connection succeeded.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Use mistral-7b'}));
    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({configs: {'local-openai': {baseUrl: 'http://localhost:1234/v1', model: 'mistral-7b'}}})
    );
  });
});
