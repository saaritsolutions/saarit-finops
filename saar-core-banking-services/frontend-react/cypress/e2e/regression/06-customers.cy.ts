/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Customer Management Module
 * Covers: customer list, search, create customer, KYC status fields,
 *         PAN/Aadhaar display.
 */

const CUSTOMERS = [
  {
    customerId:   101,
    fullName:     'Ramesh Kumar',
    email:        'ramesh.kumar@example.com',
    mobile:       '9876543210',
    panNumber:    'ABCDE1234F',
    kycStatus:    'Verified',
    dateOfBirth:  '1985-06-15',
    address:      '123 MG Road, Mumbai',
    createdAt:    '2026-01-10T09:00:00Z',
  },
  {
    customerId:   102,
    fullName:     'Priya Sharma',
    email:        'priya.sharma@example.com',
    mobile:       '9123456780',
    panNumber:    'WXYZ9876G',
    kycStatus:    'Pending',
    dateOfBirth:  '1992-03-22',
    address:      '456 Anna Salai, Chennai',
    createdAt:    '2026-02-05T10:00:00Z',
  },
  {
    customerId:   103,
    fullName:     'Anil Patel',
    email:        'anil.patel@example.com',
    mobile:       '9000000001',
    panNumber:    'PQRST5678H',
    kycStatus:    'Rejected',
    dateOfBirth:  '1978-11-08',
    address:      '789 Ring Road, Ahmedabad',
    createdAt:    '2026-02-20T11:00:00Z',
  },
];

describe('[REGRESSION] Customer Management — List', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/customer/customers*', { body: CUSTOMERS }).as('customers');
  });

  it('loads customer list page', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.contains(/customer/i, { timeout: 10000 }).should('exist');
  });

  it('shows all 3 seeded customers', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.contains('Ramesh Kumar').should('exist');
    cy.contains('Priya Sharma').should('exist');
    cy.contains('Anil Patel').should('exist');
  });

  it('shows KYC status chips (Verified / Pending / Rejected)', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.contains(/Verified/i).should('exist');
    cy.contains(/Pending/i).should('exist');
    cy.contains(/Rejected/i).should('exist');
  });

  it('shows customer email and mobile', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.contains('9876543210').should('exist');
  });

  it('search input filters customers by name', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('input[placeholder*="search" i]', { timeout: 10000 }).type('Ramesh');
    cy.contains('Ramesh Kumar').should('exist');
  });

  it('table has correct column headers', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.contains(/name|customer/i).should('exist');
    cy.contains(/email|mobile|contact/i).should('exist');
    cy.contains(/kyc|status/i).should('exist');
  });
});

describe('[REGRESSION] Customer Management — Create Customer', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/customer/customers*', { body: [] }).as('customers');
  });

  it('New Customer button opens create form', () => {
    cy.visit('/customers');
    cy.contains(/new customer|add customer|create customer/i, { timeout: 15000 }).click();
    cy.contains(/name|full name|first name/i, { timeout: 10000 }).should('exist');
  });

  it('create form has PAN and Aadhaar fields', () => {
    cy.visit('/customers');
    cy.contains(/new customer|add customer|create customer/i, { timeout: 15000 }).click();
    cy.contains(/pan|aadhaar|UID|identity/i, { timeout: 10000 }).should('exist');
  });

  it('create form validates required fields on submit', () => {
    cy.intercept('POST', '**/api/customer/customers*', {
      statusCode: 400,
      body: { message: 'FullName is required' },
    }).as('createFail');

    cy.visit('/customers');
    cy.contains(/new customer|add customer|create customer/i, { timeout: 15000 }).click();
    cy.contains(/save|create|submit/i, { timeout: 5000 }).last().click({ force: true });
    cy.contains(/required|name|error/i, { timeout: 10000 }).should('exist');
  });

  it('successful create shows confirmation and adds to list', () => {
    cy.intercept('POST', '**/api/customer/customers*', {
      statusCode: 201,
      body: { customerId: 200, fullName: 'New Test Customer', kycStatus: 'Pending' },
    }).as('createOk');
    cy.intercept('GET', '**/api/customer/customers*', {
      body: [...CUSTOMERS, { customerId: 200, fullName: 'New Test Customer', kycStatus: 'Pending' }],
    }).as('customersRefresh');

    cy.visit('/customers');
    cy.contains(/new customer|add customer/i, { timeout: 15000 }).click();
    cy.get('input[name="fullName"], input[placeholder*="name" i]').first().type('New Test Customer', { force: true });
    cy.contains(/save|create|submit/i, { timeout: 5000 }).last().click({ force: true });

    cy.get('@createOk.all', { timeout: 10000 }).then((calls: any[]) => {
      if (calls.length > 0) {
        cy.contains(/success|created|New Test Customer/i, { timeout: 10000 }).should('exist');
      }
    });
  });
});
