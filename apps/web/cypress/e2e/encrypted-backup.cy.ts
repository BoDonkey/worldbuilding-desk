const projectName = 'Cypress Smoke Project';
const PASSPHRASE = 'tide-and-salt-door';

const exportDialog = () => cy.get('[role="dialog"][aria-labelledby="export-backup-title"]');
const unlockDialog = () => cy.get('[role="dialog"][aria-labelledby="unlock-backup-title"]');

function selectBackup(button: 'Import Backup' | 'Validate Backup', blob: Blob) {
  return cy.wrap(blob.arrayBuffer()).then((buffer) => {
    cy.contains('button', button)
      .next('input[type="file"]')
      .selectFile(
        {contents: Cypress.Buffer.from(buffer as ArrayBuffer), fileName: 'cypress-smoke-backup.sagabackup', lastModified: Date.now()},
        {force: true}
      );
  });
}

describe('Encrypted project backups (5.14)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.visit('/projects');
    cy.contains('strong', projectName).should('be.visible');
    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL').callsFake((blob: Blob) => {
        (win as unknown as {lastBackup: Blob}).lastBackup = blob;
        return 'blob:cypress-backup-export';
      });
    });
  });

  function exportEncrypted() {
    cy.contains('li', projectName).within(() => cy.contains('button', 'Export Backup').click());
    exportDialog().within(() => {
      cy.contains('label', 'Encrypted backup (.sagabackup)').find('input').check();
      cy.contains('cannot be opened').should('be.visible');

      cy.contains('label', /^Passphrase/).find('input').type('short');
      cy.contains('label', 'Confirm passphrase').find('input').type('short');
      cy.contains('button', 'Export Backup').click();
      cy.contains('[role="alert"]', 'Use at least 8 characters.').should('be.visible');

      cy.contains('label', /^Passphrase/).find('input').clear().type(PASSPHRASE);
      cy.contains('label', 'Confirm passphrase').find('input').clear().type(`${PASSPHRASE}x`);
      cy.contains('button', 'Export Backup').click();
      cy.contains('[role="alert"]', 'The two passphrases do not match.').should('be.visible');

      cy.contains('label', 'Confirm passphrase').find('input').clear().type(PASSPHRASE);
      cy.contains('button', 'Export Backup').click();
    });
    exportDialog().should('not.exist');
    cy.contains('[role="status"]', `Encrypted backup exported for "${projectName}".`).should('be.visible');
    return cy.window().then((win) => (win as unknown as {lastBackup: Blob}).lastBackup);
  }

  it('exports an encrypted backup that reveals nothing without the passphrase', () => {
    exportEncrypted().then((blob) => {
      cy.wrap(blob.text()).then((text) => {
        const envelope = JSON.parse(text as string);
        expect(envelope.format).to.equal('sagaspine-encrypted-backup');
        expect(envelope.kdf).to.include({name: 'PBKDF2', hash: 'SHA-256', iterations: 600000});
        expect(text).not.to.contain(PASSPHRASE);
        expect(text).not.to.contain(projectName);
        expect(text).not.to.contain('project-snapshot.json');
      });
    });
  });

  it('fails closed on a wrong passphrase, then validates and imports with the right one', () => {
    exportEncrypted().then((blob) => {
      selectBackup('Validate Backup', blob);
      unlockDialog().within(() => {
        cy.contains('“cypress-smoke-backup.sagabackup” is encrypted.').should('be.visible');
        cy.get('input[type="password"]').type('not the passphrase');
        cy.contains('button', 'Open Backup').click();
        cy.contains('[role="alert"]', 'That passphrase does not open this backup.').should('be.visible');
        cy.get('input[type="password"]').clear().type(PASSPHRASE);
        cy.contains('button', 'Open Backup').click();
      });
      unlockDialog().should('not.exist');
      cy.contains('[role="status"]', 'passed integrity checks').should('be.visible');

      // Cancelling reads nothing.
      selectBackup('Import Backup', blob);
      unlockDialog().contains('button', 'Cancel').click();
      unlockDialog().should('not.exist');
      cy.contains('h2', 'Backup Import Preview').should('not.exist');

      selectBackup('Import Backup', blob);
      unlockDialog().within(() => {
        cy.get('input[type="password"]').type(PASSPHRASE);
        cy.contains('button', 'Open Backup').click();
      });
      cy.contains('h2', 'Backup Import Preview').should('be.visible');
      cy.contains('button', 'Apply Import').click();
      cy.contains('[role="status"]', 'Count check passed.').should('be.visible');
      cy.contains('strong', `${projectName} (Imported)`).should('be.visible');
    });
  });

  it('keeps plain backups as the default and closes without exporting on Cancel', () => {
    cy.contains('li', projectName).within(() => cy.contains('button', 'Export Backup').click());
    exportDialog().within(() => {
      cy.contains('label', 'Plain backup (.zip)').find('input').should('be.checked');
      cy.contains('label', /^Passphrase/).should('not.exist');
    });
    cy.get('body').type('{esc}');
    exportDialog().should('not.exist');
    cy.window().its('URL.createObjectURL').should('not.have.been.called');
  });
});
