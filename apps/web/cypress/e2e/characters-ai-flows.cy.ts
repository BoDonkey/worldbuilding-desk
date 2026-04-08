function installAiStub(responses: string[]): void {
  let index = 0;

  cy.on('window:before:load', (win) => {
    win.localStorage.setItem('anthropic_api_key', 'cypress-test-key');
    (
      win as typeof win & {
        electronAPI?: {
          llmComplete: () => Promise<{content: string}>;
          llmStream: () => Promise<string>;
          onLLMChunk: () => () => void;
          onLLMComplete: () => () => void;
          onLLMError: () => () => void;
        };
      }
    ).electronAPI = {
      llmComplete: async () => ({
        content: responses[Math.min(index++, responses.length - 1)] ?? ''
      }),
      llmStream: async () => 'cypress-request',
      onLLMChunk: () => () => undefined,
      onLLMComplete: () => () => undefined,
      onLLMError: () => () => undefined
    };
  });
}

function openCharactersRouteWithSeedData(aiResponses: string[]): void {
  installAiStub(aiResponses);
  cy.viewport(1400, 900);
  cy.visit('/');
  cy.seedSmokeProjectData();
  cy.reload();
  cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  cy.visit('/characters');
  cy.contains('h1', 'Characters').should('be.visible');
  cy.contains('button', 'Roster').should('be.visible');
}

function fillTextareaByLabel(label: string, value: string): void {
  cy.contains('label', label).within(() => {
    cy.get('textarea').clear().type(value, {delay: 0});
  });
}

function fillInputByLabel(label: string, value: string): void {
  cy.contains('label', label).within(() => {
    cy.get('input').clear().type(value, {delay: 0});
  });
}

describe('Characters AI workflows', () => {
  it('creates a character from manual authoring and applies Character Coach sections', () => {
    openCharactersRouteWithSeedData([
      [
        '## Contradiction',
        'She projects absolute control in public, but privately relies on superstitious rituals before every negotiation.',
        '',
        '## Social Blind Spot',
        'She mistakes careful politeness for trust and often misses when allies are only being strategically agreeable.'
      ].join('\n')
    ]);

    cy.contains('button', 'Create Manually').click();
    cy.contains('h2', 'New Character').should('be.visible');

    fillInputByLabel('Name *', 'Mira Vale');
    fillInputByLabel('Role', 'Diplomat');
    fillTextareaByLabel(
      'Description',
      'A disciplined negotiator trying to keep a crumbling canal city politically intact.'
    );

    cy.contains('strong', 'Character Coach')
      .parent()
      .parent()
      .within(() => {
        cy.contains('button', 'Find gaps').click();
      });

    cy.contains('div', 'Character Coach').should('be.visible');
    cy.contains('div', 'Contradiction').should('be.visible');
    cy.contains('button', 'Add section(s)').click();

    cy.get('input[value="Contradiction"]').should('exist');
    cy.get('input[value="Social Blind Spot"]').should('exist');
    cy.contains('div', 'Created 2 sections from Character Coach output.').should('be.visible');

    cy.contains('button', 'Create Character').click();

    cy.contains('p', 'Created character "Mira Vale".').should('be.visible');
    cy.contains('strong', 'Mira Vale')
      .closest('li')
      .within(() => {
        cy.contains('summary', 'Details').click();
        cy.contains('strong', 'Imported Sections').should('be.visible');
        cy.contains('div', 'Contradiction').should('be.visible');
        cy.contains(
          'div',
          'She projects absolute control in public, but privately relies on superstitious rituals before every negotiation.'
        ).should('be.visible');
        cy.contains('div', 'Social Blind Spot').should('be.visible');
      });
  });

  it('replaces an imported field through the Discuss modal before saving', () => {
    openCharactersRouteWithSeedData([
      'Lean, road-dusty surveyor who annotates every ruin with the names locals refuse to say aloud.'
    ]);

    cy.contains('button', 'Import Or Paste').click();
    cy.contains('h2', 'Import Character').should('be.visible');

    cy.get('textarea[placeholder*="Paste a character sheet"]').type(
      [
        'Character: Sera Thorn',
        'Role: Cartographer',
        'Age: 29',
        '',
        'Background:',
        'Keeps a private atlas of ruined roads and abandoned border shrines.'
      ].join('\n'),
      {delay: 0}
    );

    cy.contains('button', 'Review Pasted Text').click();
    cy.contains('h2', 'Character Import Review').should('be.visible');
    cy.contains('label', 'Short Description').within(() => {
      cy.get('button').contains('Discuss').click();
    });

    cy.contains('strong', 'Discuss: Import Description').should('be.visible');
    cy.contains('button', 'Add specificity').click();
    cy.contains('div', 'AI Helper').should('be.visible');
    cy.contains(
      'div',
      'Lean, road-dusty surveyor who annotates every ruin with the names locals refuse to say aloud.'
    ).should('be.visible');
    cy.contains('button', 'Replace field').click();

    cy.contains('div', 'Replaced Import Description from discussion.').should('be.visible');
    cy.contains('label', 'Short Description').within(() => {
      cy.get('textarea').should(
        'have.value',
        'Lean, road-dusty surveyor who annotates every ruin with the names locals refuse to say aloud.'
      );
    });

    cy.contains('button', 'Save Imported Character').click();

    cy.contains('p', 'Imported character "Sera Thorn".').should('be.visible');
    cy.contains('strong', 'Sera Thorn')
      .closest('li')
      .within(() => {
        cy.contains('summary', 'Details').click();
        cy.contains(
          'p',
          'Lean, road-dusty surveyor who annotates every ruin with the names locals refuse to say aloud.'
        ).should('be.visible');
      });
  });
});
