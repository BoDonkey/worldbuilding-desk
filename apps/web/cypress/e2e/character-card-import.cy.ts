import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

type StoredEntity = {id: string; name: string; needsCompletion?: boolean; fields: Record<string, string>};
type StoredNote = {id: string; title: string; content: string; kind: string};
type StoredLink = {loreDocumentId: string; targetId: string; relationship: string};

const readStore = <T,>(storeName: string): Cypress.Chainable<T[]> =>
  cy.window().then(
    (win) =>
      new Cypress.Promise<T[]>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
          request.onsuccess = () => {
            resolve(request.result as T[]);
            db.close();
          };
          request.onerror = () => {
            reject(request.error);
            db.close();
          };
        };
      })
  );

const card = (name: string) => ({
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name,
    description: '{{char}} keeps the lighthouse on Salt Point.',
    personality: 'Patient, wry.',
    first_mes: '{{char}} trims the wick.',
    system_prompt: 'Never break character.',
    character_book: {entries: [{keys: ['salt point'], content: 'Salt Point floods at spring tide.', comment: 'Salt Point'}]}
  }
});

/** A minimal PNG with the card in a `ccv3` tEXt chunk, as SillyTavern writes it. */
function cardPng(value: unknown): Uint8Array {
  const latin1 = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));
  const utf8 = new TextEncoder().encode(JSON.stringify(value));
  const payload = btoa(Array.from(utf8, (byte) => String.fromCharCode(byte)).join(''));
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    new DataView(out.buffer).setUint32(0, data.length);
    out.set(latin1(type), 4);
    out.set(data, 8);
    return out;
  };
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', new Uint8Array(13)),
    chunk('tEXt', latin1(`ccv3\0${payload}`)),
    chunk('IEND', new Uint8Array(0))
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const openCardImport = () => {
  cy.contains('[aria-label="World Bible categories"] button', /^Characters$/).click();
  cy.contains('button', 'Import a character card').click();
  return cy.get('[role="dialog"][aria-labelledby="character-card-import-title"]');
};

describe('Character card import (4.69)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('h2', 'Cypress Smoke Project').should('be.visible');
    cy.contains('a', 'World Bible').click();
    cy.contains('h1', 'World Bible').should('be.visible');
  });

  it('imports a PNG card as a draft character and Source Notes after a preview', () => {
    openCardImport().within(() => {
      cy.get('input[type="file"]').selectFile(
        {contents: Cypress.Buffer.from(cardPng(card('Oren Vale'))), fileName: 'oren.png', mimeType: 'image/png'},
        {force: true}
      );
      cy.get('input[value="Oren Vale"]').should('be.visible');
      cy.contains('Oren Vale keeps the lighthouse on Salt Point.').should('be.visible');
      cy.contains('Not imported: the card’s chat instructions').should('be.visible');
      cy.contains('The portrait image itself is not imported.').should('be.visible');
      cy.contains('label', 'Salt Point').find('input[type="checkbox"]').should('be.checked');
    });
    readStore<StoredEntity>('entities').then((entities) => {
      expect(entities.map((entity) => entity.name)).not.to.include('Oren Vale');
    });

    cy.get('[role="dialog"]').contains('button', 'Create draft character').click();
    cy.get('[role="dialog"]').contains('Created a draft character, Oren Vale. It is marked Needs completion.');

    readStore<StoredEntity>('entities').then((entities) => {
      const oren = entities.find((entity) => entity.name === 'Oren Vale');
      expect(oren?.needsCompletion).to.equal(true);
      expect(oren?.fields.description).to.contain('Oren Vale keeps the lighthouse on Salt Point.');
      expect(oren?.fields.notes).to.contain('Personality:');
      readStore<StoredNote>('lore_documents').then((notes) => {
        const cardNote = notes.find((note) => note.title === 'Character card: Oren Vale');
        const lore = notes.find((note) => note.title === 'Oren Vale lorebook: Salt Point');
        expect(cardNote?.content).not.to.contain('Never break character');
        expect(lore?.content).to.equal('Keys: salt point\n\nSalt Point floods at spring tide.');
        readStore<StoredLink>('lore_document_links').then((links) => {
          expect(links.filter((link) => link.targetId === oren?.id).map((link) => link.relationship).sort()).to.deep.equal([
            'mentions',
            'primary_subject'
          ]);
        });
      });
    });
    readStore<{status: string}>('canonical_facts').then((facts) => {
      expect(facts).to.have.length(0);
    });

    cy.get('[role="dialog"]').contains('button', 'Open Oren Vale').click();
    cy.get('[role="dialog"][aria-labelledby="character-card-import-title"]').should('not.exist');
    cy.contains('Oren Vale').should('be.visible');
  });

  it('refuses a damaged card with a reason and asks before reusing a taken name', () => {
    openCardImport().within(() => {
      cy.get('input[type="file"]').selectFile(
        {contents: Cypress.Buffer.from('{"spec":"chara_card_v2","data":{}}'), fileName: 'broken.json', mimeType: 'application/json'},
        {force: true}
      );
      cy.get('[role="alert"]').should('contain.text', 'This character card has no name.');
      cy.contains('button', 'Create draft character').should('not.exist');

      cy.get('input[type="file"]').selectFile(
        {contents: Cypress.Buffer.from(JSON.stringify(card('Wren'))), fileName: 'wren.json', mimeType: 'application/json'},
        {force: true}
      );
      cy.contains('button', 'Create draft character').click();
      cy.contains('Created a draft character, Wren.').should('be.visible');
      cy.contains('button', 'Close').click();
    });

    openCardImport().within(() => {
      cy.get('input[type="file"]').selectFile(
        {contents: Cypress.Buffer.from(JSON.stringify(card('Wren'))), fileName: 'wren-again.json', mimeType: 'application/json'},
        {force: true}
      );
      cy.contains('A character already uses this name').should('be.visible');
      cy.contains('button', 'Create draft character').should('be.disabled');
      cy.contains('label', 'Add the card to Wren').click();
      cy.contains('button', 'Add to Wren').click();
      cy.contains('Added the card to Wren as a Source Note; the character itself is unchanged.').should('be.visible');
    });
    readStore<StoredEntity>('entities').then((entities) => {
      expect(entities.filter((entity) => entity.name === 'Wren')).to.have.length(1);
    });
    readStore<StoredNote>('lore_documents').then((notes) => {
      expect(notes.filter((note) => note.title === 'Character card: Wren')).to.have.length(2);
    });
  });
});
