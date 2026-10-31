import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

// Slice 5.17: typing, backward deletion, and autosave in a long scene must not
// move the scroll position, the caret, or the surrounding text.

const SCENE_ID = 'scene-long';
const PARAGRAPHS = 120;

const longScene = () =>
  Array.from({length: PARAGRAPHS}, (_, index) =>
    `<p>Long paragraph ${index + 1}. The caravan crossed the salt flats before dawn.</p>`
  ).join('');

type ScrollWindow = Window & {__wbdScrollSamples?: number[]; __wbdStopSampling?: () => void};

function seedLongScene(): Cypress.Chainable<void> {
  return cy.window({log: false}).then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const request = win.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('writingDocuments', 'readwrite');
          const now = Date.now();
          tx.objectStore('writingDocuments').put({
            id: SCENE_ID,
            projectId: 'cypress-project-1',
            title: 'Long Scene',
            content: longScene(),
            createdAt: now + 10,
            updatedAt: now + 10
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      })
  );
}

function readSavedScene(): Cypress.Chainable<string> {
  return cy.window({log: false}).then(
    (win) =>
      new Cypress.Promise<string>((resolve, reject) => {
        const request = win.indexedDB.open(DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction('writingDocuments').objectStore('writingDocuments').get(SCENE_ID);
          get.onsuccess = () => {
            db.close();
            resolve(String(get.result?.content ?? ''));
          };
          get.onerror = () => reject(get.error);
        };
      })
  );
}

const editorScroller = () => cy.get<HTMLElement>('[data-wbd-scroll-key="workspace-editor"]');
const targetParagraph = () => cy.contains('.tiptap-editor p', 'Long paragraph 60.');

/** Records the scroller's scrollTop on every animation frame until stopped. */
function startSampling() {
  editorScroller().then(($scroller) => {
    const scroller = $scroller[0];
    const win = scroller.ownerDocument.defaultView as ScrollWindow;
    const samples: number[] = [];
    let frame = 0;
    const sample = () => {
      samples.push(scroller.scrollTop);
      frame = win.requestAnimationFrame(sample);
    };
    sample();
    win.__wbdScrollSamples = samples;
    win.__wbdStopSampling = () => win.cancelAnimationFrame(frame);
  });
}

/** Scrolls the way an author would until the target paragraph sits at `fraction` of the viewport. */
function scrollTargetTo(fraction: number) {
  targetParagraph().then(($paragraph) => {
    editorScroller().then(($scroller) => {
      const scroller = $scroller[0];
      const offset = $paragraph[0].getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.dispatchEvent(new WheelEvent('wheel', {bubbles: true, deltaY: offset}));
      scroller.scrollTop += offset - scroller.clientHeight * fraction;
      scroller.dispatchEvent(new Event('scroll'));
    });
  });
  cy.wait(300);
}

function stopSampling(): Cypress.Chainable<number[]> {
  return cy.window().then((win) => {
    const scrollWindow = win as ScrollWindow;
    scrollWindow.__wbdStopSampling?.();
    return scrollWindow.__wbdScrollSamples ?? [];
  });
}

describe('Workspace writing stability in a long scene', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    seedLongScene();
    cy.reload();
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('button', 'Scenes').click();
    cy.contains('span', 'Long Scene').click({force: true});
    targetParagraph().should('exist');
    cy.contains('button', 'Close').click();
    cy.contains('button', 'Close').should('not.exist');
  });

  it('keeps scroll, caret, and text in place through typing, deletion, and autosave', () => {
    scrollTargetTo(1 / 3);
    targetParagraph().click('right', {scrollBehavior: false});

    editorScroller().then(($scroller) => {
      const startTop = $scroller[0].scrollTop;
      expect(startTop, 'scene is scrolled well past the top').to.be.greaterThan(500);
      startSampling();

      // Each burst crosses the 800 ms autosave debounce.
      cy.get('.tiptap-editor').type(' Wind rose', {delay: 40, scrollBehavior: false});
      cy.wait(1200);
      cy.get('.tiptap-editor').type('{backspace}{backspace}{backspace}{backspace}', {delay: 40, scrollBehavior: false});
      cy.wait(1200);
      cy.get('.tiptap-editor').type('fell and the dunes shifted', {delay: 40, scrollBehavior: false});
      cy.wait(1200);
      // Sustained backward deletion of " and the dunes shifted".
      cy.get('.tiptap-editor').type('{backspace}'.repeat(22), {delay: 30, scrollBehavior: false});
      cy.wait(1200);

      stopSampling().then((samples) => {
        expect(samples.length, 'sampled frames').to.be.greaterThan(60);
        const drift = Math.max(...samples.map((top) => Math.abs(top - startTop)));
        expect(drift, 'largest scroll movement while writing (px)').to.be.at.most(2);
      });
    });

    // Typing landed where the caret was, and autosave persisted it.
    targetParagraph().should('contain.text', 'before dawn. Wind fell');
    cy.contains('.tiptap-editor p', 'Long paragraph 1.').should('exist');
    cy.contains('.tiptap-editor p', `Long paragraph ${PARAGRAPHS}.`).should('exist');
    readSavedScene().should('contain', 'before dawn. Wind fell</p>');
  });
  it('follows the caret down without snapping back when new lines pass the bottom edge', () => {
    scrollTargetTo(0.85);
    targetParagraph().click('right', {scrollBehavior: false});
    startSampling();

    for (let line = 1; line <= 8; line += 1) {
      cy.get('.tiptap-editor').type(`{enter}Added line ${line}`, {delay: 25, scrollBehavior: false});
    }
    cy.wait(1200);

    stopSampling().then((samples) => {
      const largestSnapBack = Math.max(0, ...samples.slice(1).map((top, i) => samples[i] - top));
      expect(largestSnapBack, 'largest backward scroll jump while adding lines (px)').to.be.at.most(2);
    });
    cy.contains('.tiptap-editor p', 'Added line 8').then(($line) => {
      editorScroller().then(($scroller) => {
        const viewport = $scroller[0].getBoundingClientRect();
        const caretLine = $line[0].getBoundingClientRect();
        expect(caretLine.bottom, 'caret line stays inside the editor').to.be.at.most(viewport.bottom + 1);
        expect(caretLine.top).to.be.at.least(viewport.top - 1);
      });
    });
  });
});
