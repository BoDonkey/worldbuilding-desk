import type {MechanicsProgressScope} from '../../entityTypes';

export type CompendiumTab =
  | 'overview'
  | 'entries'
  | 'progression'
  | 'world-systems';

export interface CompendiumNextStepItem {
  id: string;
  done: boolean;
  label: string;
  tab: CompendiumTab;
}

export const COMPENDIUM_TABS: Array<{
  id: CompendiumTab;
  label: string;
  subtitle: string;
  advanced?: boolean;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'Start here: current progression status and next actions.'
  },
  {
    id: 'entries',
    label: 'Entries',
    subtitle: 'Create/import mechanics entries and record progression actions.'
  },
  {
    id: 'progression',
    label: 'Progression',
    subtitle: 'Manage milestones, recipes, and craftability checks.'
  },
  {
    id: 'world-systems',
    label: 'World Systems',
    subtitle: 'Advanced systems: zone, settlement, and party synergy.',
    advanced: true
  }
];

export const MECHANICS_SCOPE_OPTIONS: Array<{
  value: Exclude<MechanicsProgressScope, 'party'>;
  label: string;
}> = [
  {value: 'character', label: 'Per character'},
  {value: 'global', label: 'Shared / global'}
];
