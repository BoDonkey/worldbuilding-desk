describe('World Canvas', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('captures optional worldbuilding notes and restores them after reload', () => {
    cy.visit('/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'World Canvas').click();

    cy.contains('h2', 'World Canvas').should('be.visible');
    cy.contains(/Nothing here is canon/i).should('be.visible');
    cy.contains('h2', 'Characters').should('not.exist');
    cy.get('textarea[placeholder*="borrowed memories"]')
      .type('A river city trades years of memory for safe passage.');

    cy.contains('article', 'People').within(() => cy.contains('button', 'Open lens').click());
    cy.contains('label', 'People notes')
      .find('textarea')
      .type('Ferrymen remember every bargain, even when travelers do not.');

    cy.contains('article', 'Constraints and costs').within(() => {
      cy.contains('button', 'Open lens').click();
    });
    cy.contains('label', 'Constraints and costs notes')
      .find('textarea')
      .type('Every crossing costs a cherished memory.');

    const questions = [
      'Who records the memories that were traded?',
      'What happens when the river refuses a bargain?',
      'Which faction profits from forgotten crossings?'
    ];
    questions.forEach((question, index) => {
      cy.get('#world-canvas-new-question').type(question);
      if (index === 0) cy.get('#world-canvas-question-lens').select('People');
      cy.contains('button', 'Add question').click();
    });

    questions.forEach((question) => cy.contains(question).should('be.visible'));
    cy.contains('label', 'Question 2 status').find('select').select('Answered');
    cy.contains('label', 'Question 3 status').find('select').select('Dropped');
    cy.contains('Saving...').should('be.visible');
    cy.contains(/Saved at/).should('be.visible');

    cy.reload();
    cy.contains('button', 'World Canvas').click();
    cy.get('textarea[placeholder*="borrowed memories"]')
      .should('have.value', 'A river city trades years of memory for safe passage.');
    cy.contains('label', 'People notes')
      .find('textarea')
      .should('have.value', 'Ferrymen remember every bargain, even when travelers do not.');
    cy.contains('label', 'Constraints and costs notes')
      .find('textarea')
      .should('have.value', 'Every crossing costs a cherished memory.');
    questions.forEach((question) => cy.contains(question).should('be.visible'));
    cy.contains('label', 'Question 2 status').find('select').should('have.value', 'answered');
    cy.contains('label', 'Question 3 status').find('select').should('have.value', 'dropped');

    cy.viewport(780, 900);
    cy.contains('h2', 'World Canvas').should('be.visible');
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth);
    });
  });

  it('marks an empty question as invalid without adding it', () => {
    cy.visit('/world-bible');
    cy.contains('button', 'World Canvas').click();
    cy.contains('button', 'Add question').click();

    cy.get('#world-canvas-new-question')
      .should('have.attr', 'aria-invalid', 'true')
      .and('have.attr', 'aria-describedby', 'world-canvas-question-error');
    cy.contains('Enter a question before adding it.').should('be.visible');
  });
});
