import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

const projectName = 'Cypress Smoke Project';
const PASSPHRASE = 'tide-and-salt-door';
const NEW_PASSPHRASE = 'lantern-over-the-reef';

const projectCard = () => cy.contains('li', projectName);
const lockedCard = () => cy.contains('li', 'Locked project');
const dialog = (titleId: string) => cy.get(`[role="dialog"][aria-labelledby="${titleId}"]`);

/** Every record in the main database, exactly as stored. */
function storedText(): Cypress.Chainable<string> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<string>((resolve, reject) => {
        const open = win.indexedDB.open(DB_NAME, DB_VERSION);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = Array.from(db.objectStoreNames);
          const tx = db.transaction(names, 'readonly');
          const parts: string[] = [];
          names.forEach((name) => {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => parts.push(JSON.stringify(request.result));
          });
          tx.oncomplete = () => {
            db.close();
            resolve(parts.join('\n'));
          };
          tx.onerror = () => reject(tx.error);
        };
      })
  );
}

function protectProject() {
  projectCard().within(() => cy.contains('button', 'Protect with Passphrase').click());
  dialog('protect-project-title').within(() => {
    cy.contains('cannot be recovered').should('be.visible');
    cy.contains('old fragments may remain').should('be.visible');
    cy.contains('not secure deletion').should('be.visible');
    cy.contains('label', /^Passphrase/).find('input').type('short');
    cy.contains('label', /^Confirm passphrase/).find('input').type('short');
    cy.contains('button', 'Protect Project').click();
    cy.contains('[role="alert"]', 'Use at least 8 characters.').should('be.visible');

    cy.contains('label', /^Passphrase/).find('input').clear().type(PASSPHRASE);
    cy.contains('label', /^Confirm passphrase/).find('input').clear().type(PASSPHRASE);
    cy.contains('button', 'Protect Project').click();
    cy.contains('[role="alert"]', 'cannot be recovered').should('be.visible');

    cy.contains('label', 'I understand').find('input').check();
    cy.contains('button', 'Protect Project').click();
  });
  dialog('protect-project-title').should('not.exist');
  cy.contains('[role="status"]', `"${projectName}" is now protected.`).should('be.visible');
}

function unlock(passphrase: string) {
  lockedCard().within(() => cy.contains('button', 'Unlock and Open').click());
  dialog('unlock-project-title').within(() => {
    cy.get('input[type="password"]').type(passphrase);
    cy.contains('button', 'Unlock').click();
  });
}

describe('Password-protected projects (5.15)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.visit('/projects');
    cy.contains('strong', projectName).should('be.visible');
    cy.contains('Projects are stored locally.').should('be.visible');
  });

  it('protects a project, shows only its label while locked, and opens it with the passphrase', () => {
    protectProject();
    storedText().then((text) => {
      expect(text).not.to.contain(projectName);
      expect(text).not.to.contain('Alpha content');
    });
    cy.window().then((win) => {
      expect(win.localStorage.getItem('wbd-app-shell') ?? '').not.to.contain(projectName);
    });

    projectCard().within(() => cy.contains('button', 'Lock Project').click());
    lockedCard().should('contain.text', '(locked)');
    cy.contains(projectName).should('not.exist');
    cy.get('body').should('not.contain.text', 'Alpha');

    lockedCard().within(() => cy.contains('button', 'Unlock and Open').click());
    dialog('unlock-project-title').within(() => {
      cy.get('input[type="password"]').type('not the passphrase');
      cy.contains('button', 'Unlock').click();
      cy.contains('[role="alert"]', 'That passphrase does not unlock this project.').should('be.visible');
      cy.get('input[type="password"]').clear().type(PASSPHRASE);
      cy.contains('button', 'Unlock').click();
    });
    cy.location('pathname').should('eq', '/workspace');
    cy.contains('Alpha Scene').should('be.visible');

    // The palette locks it from anywhere.
    cy.get('body').type('{ctrl}k');
    cy.get('input[placeholder="Type a command..."]').type('lock project');
    cy.contains('[role="option"]', 'Lock Project').click();
    cy.contains('Alpha Scene').should('not.exist');
    cy.visit('/projects');
    lockedCard().should('be.visible');
    cy.contains(projectName).should('not.exist');
  });

  it('locks again on restart and keeps working after a passphrase change', () => {
    protectProject();
    cy.reload();
    cy.visit('/projects');
    lockedCard().should('be.visible');
    cy.contains(projectName).should('not.exist');

    unlock(PASSPHRASE);
    cy.contains('Alpha Scene').should('be.visible');
    cy.visit('/projects');
    // A fresh page load is a restart: the project is locked again.
    unlock(PASSPHRASE);
    cy.contains('Alpha Scene').should('be.visible');
    // Back to Projects without reloading, so the project stays unlocked.
    cy.contains('a, button', 'Projects').first().click();
    cy.location('pathname').should('eq', '/projects');

    projectCard().within(() => cy.contains('button', 'Change Passphrase').click());
    dialog('change-project-passphrase-title').within(() => {
      cy.contains('label', 'Current passphrase').find('input').type('wrong passphrase');
      cy.contains('label', /^New passphrase/).find('input').type(NEW_PASSPHRASE);
      cy.contains('label', 'Confirm new passphrase').find('input').type(NEW_PASSPHRASE);
      cy.contains('button', 'Change Passphrase').click();
      cy.contains('[role="alert"]', 'does not unlock').should('be.visible');
      cy.contains('label', 'Current passphrase').find('input').clear().type(PASSPHRASE);
      cy.contains('button', 'Change Passphrase').click();
    });
    cy.contains('[role="status"]', 'was changed').should('be.visible');

    cy.reload();
    cy.visit('/projects');
    unlock(PASSPHRASE);
    dialog('unlock-project-title').contains('[role="alert"]', 'does not unlock').should('be.visible');
    dialog('unlock-project-title').within(() => {
      cy.get('input[type="password"]').clear().type(NEW_PASSPHRASE);
      cy.contains('button', 'Unlock').click();
    });
    cy.contains('Alpha Scene').should('be.visible');
  });

  it('offers an encrypted backup by default and removes protection with the passphrase', () => {
    protectProject();
    projectCard().within(() => cy.contains('button', 'Export Backup').click());
    cy.get('[role="dialog"][aria-labelledby="export-backup-title"]').within(() => {
      cy.contains('label', 'Encrypted backup (.sagabackup)').find('input').should('be.checked');
      cy.contains('a plain backup is not').should('be.visible');
      cy.contains('button', 'Cancel').click();
    });

    projectCard().within(() => cy.contains('button', 'Remove Protection').click());
    dialog('remove-protection-title').within(() => {
      cy.get('input[type="password"]').type(PASSPHRASE);
      cy.contains('button', 'Remove Protection').click();
    });
    cy.contains('[role="status"]', 'is no longer protected').should('be.visible');
    storedText().should('contain', projectName).and('contain', 'Alpha content');
    cy.reload();
    cy.visit('/projects');
    projectCard().within(() => cy.contains('button', 'Protect with Passphrase').should('be.visible'));
  });
});
