const PROJECT_ID = 'cypress-project-1';
const LEDGER_KEY = `inspectorBudget:${PROJECT_ID}`;

const localDayKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

/**
 * Writes the budget ledger directly. The service reads it on every render, so this is how a spec
 * reaches an over-budget state without making 20 real provider calls.
 */
function seedLedger(ledger: {
  total?: number;
  byFeature?: Record<string, number>;
  local?: number;
  granted?: number;
}): void {
  cy.window().then((win) => {
    win.localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify({
        v: 2,
        day: localDayKey(),
        total: ledger.total ?? 0,
        byFeature: ledger.byFeature ?? {},
        local: ledger.local ?? 0,
        granted: ledger.granted ?? 0
      })
    );
  });
}

const openStoryDashboard = () => {
  cy.visit('/corkboard');
  cy.contains('button', 'Story Dashboard').click();
  cy.contains('h2', 'Writing coach').should('be.visible');
};

describe('AI consultation budget', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('h2', 'Cypress Smoke Project').should('be.visible');
  });

  it('states the cost and what is left beside the action that spends it', () => {
    seedLedger({total: 3, byFeature: {assistant: 2, 'writing-coach': 1}});
    openStoryDashboard();

    cy.contains('h2', 'Writing coach')
      .closest('section')
      .within(() => {
        cy.contains("Costs 1 of this project's 20 daily AI consultations").should('be.visible');
        cy.contains('17 left').should('be.visible');
        cy.contains('resetting at midnight tonight').should('be.visible');
        cy.contains('3/20 today').should('be.visible');
        cy.contains('button', 'Ask the coach').should('not.be.disabled');
      });
  });

  it('blocks at the limit, says when it resets, and offers more for today', () => {
    seedLedger({total: 20, byFeature: {assistant: 20}});
    openStoryDashboard();

    cy.contains('h2', 'Writing coach')
      .closest('section')
      .within(() => {
        cy.contains('[role="alert"]', 'You have used all 20 AI consultations').should('be.visible');
        cy.contains('[role="alert"]', 'midnight tonight').should('be.visible');
        cy.contains('button', 'Add 10 more for today').click();

        // The grant applies immediately, in place — no trip to Settings.
        cy.contains('[role="alert"]', 'You have used all').should('not.exist');
        cy.contains("Costs 1 of this project's 30 daily AI consultations").should('be.visible');
        cy.contains('10 left').should('be.visible');
        cy.contains('20/30 today').should('be.visible');
      });
  });

  it('exempts a local provider and says so at the point of use', () => {
    cy.setSeededProjectProvider('ollama');
    seedLedger({total: 20, byFeature: {assistant: 20}, local: 4});
    cy.reload();
    openStoryDashboard();

    cy.contains('h2', 'Writing coach')
      .closest('section')
      .within(() => {
        cy.contains('Runs on your local model').should('be.visible');
        cy.contains('does not use your daily consultations').should('be.visible');
        cy.contains('Local model').should('be.visible');
        // Spent budget must not block a local request.
        cy.contains('button', 'Ask the coach').should('not.be.disabled');
        cy.contains('[role="alert"]', 'You have used all').should('not.exist');
      });
  });

  it('explains the limit, its reset, and today’s per-feature usage in Settings', () => {
    seedLedger({
      total: 5,
      byFeature: {assistant: 3, 'writing-coach': 1, 'canon-decision': 1},
      local: 2
    });
    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('AI Settings');
    cy.contains('button', 'Show advanced settings').click();

    cy.contains('label', 'Max consultations per day')
      .closest('div')
      .within(() => {
        cy.contains('Guards against runaway loops').should('be.visible');
        cy.contains('resets at midnight tonight').should('be.visible');
        cy.contains('Local (Ollama) providers do not spend it at all.').should('be.visible');
        cy.contains('5 of 20 used').should('be.visible');
        cy.contains('2 local requests, unbudgeted').should('be.visible');
        cy.contains('li', 'Writing assistant').should('contain.text', '3');
        cy.contains('li', 'Writing coach').should('contain.text', '1');
        cy.contains('li', 'Canon decisions').should('contain.text', '1');
      });
  });
});
