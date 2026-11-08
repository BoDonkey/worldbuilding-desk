import type {AppStateKindRegistry} from './types';

export const locationAppKinds = {
  location_set: {
    sheetForm: {
      label: 'Set location',
      fields: [
        {type: 'text', value: 'locationName', label: 'Location', placeholder: 'South Gate'}
      ],
      build: ({actorId, locationName}) =>
        locationName ? {type: 'location_set', actorId, locationName} : null,
      load: (command) => ({locationName: command.locationName})
    },
    composer: {
      label: 'Set location',
      input: {type: 'name', label: 'Location', inventoryChoice: false, quantity: false},
      build: ({actorId, name}) =>
        name ? {type: 'location_set', actorId, locationName: name} : null,
      load: (command) => ({name: command.locationName})
    },
    fromObservation: (observation, actorId) =>
      observation.target
        ? {type: 'location_set', actorId, locationName: observation.target}
        : null,
    historyLabel: (command) => `Move to ${command.locationName}`,
    dashboardCategory: 'Locations'
  }
} satisfies Pick<AppStateKindRegistry, 'location_set'>;
