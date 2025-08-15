// Cypress E2E test for Expression Builder basic functionality
describe('Expression Builder E2E Tests', () => {
  beforeEach(() => {
    // Visit the Expression Builder page
    cy.visit('/expressions')
    
    // Wait for either Expression Builder or Login page to load
    cy.get('body').then(($body) => {
      if ($body.text().includes('Login') || $body.text().includes('Sign In')) {
        // Handle login if auth is required
        cy.log('Authentication required - skipping tests for now')
        return
      } else {
        // Wait for Expression Builder to load
        cy.contains('Expression Builder', { timeout: 10000 }).should('be.visible')
      }
    })
  })

  describe('Page Loading and Navigation', () => {
    it('should display the main interface correctly', () => {
      // Check main heading
      cy.contains('Expression Builder').should('be.visible')
      cy.contains('Create, edit, and test business rule expressions for banking operations.').should('be.visible')
      
      // Check that all tabs are visible
      cy.contains('Expressions').should('be.visible')
      cy.contains('Create/Edit').should('be.visible') 
      cy.contains('Templates').should('be.visible')
      cy.contains('Functions').should('be.visible')
      cy.contains('Test').should('be.visible')
    })

    it('should navigate between tabs correctly', () => {
      // Initially on Expressions tab
      cy.contains('Expression List').should('be.visible')
      
      // Navigate to Templates tab
      cy.contains('Templates').click()
      cy.contains('Expression Templates').should('be.visible')
      
      // Navigate to Functions tab
      cy.contains('Functions').click()
      cy.contains('Banking Functions & Operators').should('be.visible')
      
      // Navigate to Test tab
      cy.contains('Test').click()
      cy.contains('Expression Tester').should('be.visible')
      
      // Navigate to Create/Edit tab
      cy.contains('Create/Edit').click()
      cy.contains('Create Expression').should('be.visible')
    })
  })

  describe('Expression List', () => {
    it('should load and display existing expressions', () => {
      // Should be on expressions tab by default
      cy.contains('Expression List').should('be.visible')
      
      // Wait for expressions to load
      cy.get('table', { timeout: 10000 }).should('be.visible')
      
      // Check table headers
      cy.contains('Name').should('be.visible')
      cy.contains('Description').should('be.visible')
      cy.contains('Category').should('be.visible')
      cy.contains('Status').should('be.visible')
      cy.contains('Created').should('be.visible')
      cy.contains('Actions').should('be.visible')
    })
  })
});
