export {};

const projectName = 'Cypress Smoke Project';
const DAY_MS = 24 * 60 * 60 * 1000;

const reminder = () => cy.get('[data-testid="backup-reminder"]');
const exportDialog = () => cy.get('[role="dialog"][aria-labelledby="export-backup-title"]');

/** The seeded project, made ten days old and never backed up. */
function ageSeededProject() {
  const now = Date.now();
  cy.putIndexedDbRecords('projects', [
    {
      id: 'cypress-project-1',
      name: projectName,
      inheritRag: true,
      inheritShodh: true,
      storageSchemaVersion: 12,
      createdAt: now - 10 * DAY_MS,
      updatedAt: now - 10 * DAY_MS
    }
  ]);
}

describe('Backup reminder (4.93)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    ageSeededProject();
  });

  it('exporting a backup from the reminder clears it on Projects and in the Workspace', () => {
    cy.visit('/projects');
    cy.contains('li', projectName).should('contain.text', 'Never backed up');
    reminder().should('contain.text', `"${projectName}" has never been backed up.`);
    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL').returns('blob:cypress-backup-export');
    });

    reminder().contains('button', 'Back up now').click();
    exportDialog().within(() => {
      cy.contains('label', 'Plain backup (.zip)').find('input').should('be.checked');
      cy.contains('button', 'Export Backup').click();
    });
    cy.contains('[role="status"]', `Backup exported for "${projectName}".`).should('be.visible');
    reminder().should('not.exist');
    cy.contains('li', projectName).should('contain.text', 'Last backup: today');

    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    reminder().should('not.exist');
  });

  it('shows at the top of the Workspace and stays away for a day after Remind me later', () => {
    cy.visit('/workspace');
    reminder().should('contain.text', `"${projectName}" has never been backed up.`);
    reminder().contains('button', 'Remind me later').click();
    reminder().should('not.exist');

    cy.reload();
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    reminder().should('not.exist');
    cy.visit('/projects');
    cy.contains('li', projectName).should('contain.text', 'Never backed up');
    reminder().should('not.exist');
  });
});
