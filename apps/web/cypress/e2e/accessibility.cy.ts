import type {Options as AxeOptions} from 'cypress-axe';

const themes = ['light', 'dark'] as const;

const wcagRules: AxeOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
  }
};

function checkPageAccessibility() {
  // Measure settled colors: axe can otherwise sample a control mid-transition
  // on a slow first load and report an in-between shade.
  cy.document().then((doc) => {
    if (doc.getElementById('a11y-no-motion')) return;
    const style = doc.createElement('style');
    style.id = 'a11y-no-motion';
    style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    doc.head.appendChild(style);
  });
  cy.injectAxe();
  cy.checkA11y(undefined, wcagRules, (violations) => {
    const details = violations.map((violation) => {
      const nodes = violation.nodes
        .map((node) => `${node.target.join(', ')}: ${node.failureSummary ?? 'failed'}`)
        .join('\n');
      return `${violation.id}: ${violation.help}\n${nodes}`;
    });
    throw new Error(details.join('\n'));
  });
}

describe('Accessibility baseline', () => {
  themes.forEach((theme) => {
    it(`scans the Getting Started workspace in ${theme} mode`, () => {
      cy.viewport(1400, 1000);
      cy.visit('/', {
        onBeforeLoad(win) {
          win.indexedDB.deleteDatabase('worldbuilding-db');
          win.localStorage.setItem('theme', theme);
        }
      });
      cy.contains('button', 'Explore a sample project').click();
      cy.contains('h2', 'Getting started').should('be.visible');
      cy.get('html').should('have.attr', 'data-theme', theme);
      checkPageAccessibility();
    });

    it(`scans primary writing and settings routes in ${theme} mode`, () => {
      cy.viewport(1400, 1000);
      cy.visit('/', {
        onBeforeLoad(win) {
          win.localStorage.setItem('theme', theme);
        }
      });
      cy.seedSmokeProjectData();
      cy.window().then((win) => win.localStorage.setItem('theme', theme));

      cy.visit('/workspace');
      cy.get('html').should('have.attr', 'data-theme', theme);
      cy.contains('h1', 'Writing Workspace').should('be.visible');
      checkPageAccessibility();

      cy.visit('/settings');
      cy.contains('h1', 'Settings').should('be.visible');
      checkPageAccessibility();
    });

    it(`scans a destructive confirmation dialog in ${theme} mode`, () => {
      cy.viewport(1400, 1000);
      cy.visit('/', {
        onBeforeLoad(win) {
          win.localStorage.setItem('theme', theme);
        }
      });
      cy.seedSmokeProjectData();
      cy.window().then((win) => win.localStorage.setItem('theme', theme));
      cy.visit('/projects');

      cy.contains('li', 'Cypress Smoke Project').within(() => {
        cy.contains('button', /^Delete$/).click();
      });
      cy.get('[role="dialog"]').should('be.visible');
      checkPageAccessibility();
    });
  });
});
