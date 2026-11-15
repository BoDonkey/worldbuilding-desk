/*
 * The window events a repository fires after it writes, so open views can
 * reload (slice 3.52). Name them through `RECORDS_CHANGED` instead of a
 * string literal: a typo in a literal listens for an event nobody fires and
 * fails silently.
 */
export const RECORDS_CHANGED = {
  alias: 'wbd:alias-records-changed',
  canonDecision: 'wbd:canon-decision-records-changed',
  character: 'wbd:character-records-changed',
  characterSheet: 'wbd:character-sheet-records-changed',
  compendium: 'wbd:compendium-records-changed',
  entity: 'wbd:entity-records-changed',
  lore: 'wbd:lore-records-changed',
  loreFact: 'wbd:lore-fact-records-changed',
  maps: 'wbd:maps-changed',
  stateMutationEvents: 'wbd:state-mutation-events-changed',
  writing: 'wbd:writing-records-changed'
} as const;

export type RecordsChangedEvent = (typeof RECORDS_CHANGED)[keyof typeof RECORDS_CHANGED];
