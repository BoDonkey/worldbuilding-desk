// @vitest-environment jsdom
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {getDefaultFeatureToggles, getProjectCapabilities, normalizeFeatureToggles} from '../../projectMode';
import {FeatureTogglesFields} from './FeatureTogglesFields';

describe('FeatureTogglesFields (4.88)', () => {
  it('shows the four toggles with what each one shows in LitRPG', () => {
    const onChange = vi.fn();
    render(<FeatureTogglesFields projectMode='litrpg' featureToggles={getDefaultFeatureToggles('litrpg')} onChange={onChange} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.getByRole('checkbox', {name: 'Enable Game Systems'})).toHaveAccessibleDescription(
      /Character sheets, the Compendium, stat pins/
    );
    expect(screen.getByRole('checkbox', {name: 'Enable Rule Authoring'})).toHaveAccessibleDescription(/Ruleset page/);
    fireEvent.click(screen.getByRole('checkbox', {name: 'Enable Runtime Modifiers'}));
    expect(onChange).toHaveBeenCalledWith('enableRuntimeModifiers', false);
  });

  it('replaces the toggles with one line in General Fiction', () => {
    render(<FeatureTogglesFields projectMode='general' featureToggles={getDefaultFeatureToggles('general')} onChange={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Mechanics and rulesets are off in General Fiction/)).toHaveTextContent(
      'switch Project Mode to LitRPG Author'
    );
  });

  it('keeps the toggles in General Fiction while Game Systems is on, so it can be turned off', () => {
    const onChange = vi.fn();
    render(
      <FeatureTogglesFields
        projectMode='general'
        featureToggles={{...getDefaultFeatureToggles('general'), enableGameSystems: true}}
        onChange={onChange}
      />
    );
    const gameSystems = screen.getByRole('checkbox', {name: 'Enable Game Systems'});
    expect(gameSystems).toBeChecked();
    fireEvent.click(gameSystems);
    expect(onChange).toHaveBeenCalledWith('enableGameSystems', false);
  });

  it('still reads all four stored toggles, which the Compendium uses', () => {
    const toggles = normalizeFeatureToggles({mode: 'general', featureToggles: {enableGameSystems: true, enableSettlementAndZoneSystems: true}});
    const capabilities = getProjectCapabilities({projectMode: 'general', featureToggles: toggles} as never);
    expect(capabilities.canUseGameSystems).toBe(true);
    expect(capabilities.canUseSettlementAndZoneSystems).toBe(true);
    expect(capabilities.canUseRuntimeModifiers).toBe(false);
  });
});
