import type {AppStateKindRegistry} from './types';

const reasonOrNothing = (reason: string): {reason?: string} => {
  const trimmed = reason.trim();
  return trimmed ? {reason: trimmed} : {};
};

export const progressionAppKinds = {
  xp_gain: {
    sheetForm: {
      label: 'Gain XP',
      fields: [
        {type: 'number', label: 'XP gained'},
        {
          type: 'text',
          value: 'textValue',
          label: 'Reason (optional)',
          placeholder: 'Defeated the cave troll'
        }
      ],
      // Zero also covers an empty field, which the form reads as 0.
      build: ({actorId, numericValue, textValue}) =>
        Number.isFinite(numericValue) && numericValue !== 0
          ? {type: 'xp_gain', actorId, amount: numericValue, ...reasonOrNothing(textValue)}
          : null,
      load: (command) => ({
        numberValue: String(command.amount),
        textValue: command.reason ?? ''
      })
    },
    composer: {
      label: 'Gain XP',
      input: {
        type: 'amount',
        valueLabel: 'XP gained',
        valuePlaceholder: '250',
        noteLabel: 'Reason (optional)',
        notePlaceholder: 'Defeated the cave troll'
      },
      build: ({actorId, value, name}) =>
        value !== null && value !== 0
          ? {type: 'xp_gain', actorId, amount: value, ...reasonOrNothing(name)}
          : null,
      load: (command) => ({value: String(command.amount), name: command.reason ?? ''})
    },
    fromObservation: (observation, actorId) =>
      typeof observation.amount === 'number' && observation.amount > 0
        ? {type: 'xp_gain', actorId, amount: observation.amount}
        : null,
    historyLabel: (command) =>
      `XP ${command.amount >= 0 ? '+' : ''}${command.amount}${command.reason ? ` (${command.reason})` : ''}`,
    dashboardCategory: 'Progression'
  }
} satisfies Pick<AppStateKindRegistry, 'xp_gain'>;
