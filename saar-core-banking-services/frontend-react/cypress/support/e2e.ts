export {};

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsDemo(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginAsDemo', () => {
  window.localStorage.setItem('auth-token', `mock-jwt-token-${Date.now()}`);
});

// Enable Testing Library commands (findByLabelText, etc.)
import '@testing-library/cypress/add-commands';
