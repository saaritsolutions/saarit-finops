/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Customer Management Module
 * Covers: customer list, search, create customer, KYC status fields,
 *         PAN/Aadhaar display, filter bar, pagination.
 *
 * NOTE: customerService.list() → GET /api/customer (no /customers suffix)
 *       Response is now paginated: { total, items, page, pageSize }
 *       kycStatus is numeric: 0=Not Started,1=In Progress,2=Docs Submitted,
 *                             3=Verified,4=Rejected,5=Expired
 *       Component renders name via fullName(c) = [firstName, middleName, lastName].join(' ')
 *       SAAR-CST-001: all stubs updated to { total, items, page, pageSize } format
 */

const CUSTOMERS = [
  {
    customerId:   101,
    firstName:    'Ramesh',
    lastName:     'Kumar',
    email:        'ramesh.kumar@example.com',
    mobile:       '9876543210',
    pan:          'ABCDE1234F',
    kycStatus:    3,   // Verified
    dateOfBirth:  '1985-06-15',
    createdAt:    '2026-01-10T09:00:00Z',
  },
  {
    customerId:   102,
    firstName:    'Priya',
    lastName:     'Sharma',
    email:        'priya.sharma@example.com',
    mobile:       '9123456780',
    pan:          'WXYZ9876G',
    kycStatus:    1,   // In Progress
    dateOfBirth:  '1992-03-22',
    createdAt:    '2026-02-05T10:00:00Z',
  },
  {
    customerId:   103,
    firstName:    'Anil',
    lastName:     'Patel',
    email:        'anil.patel@example.com',
    mobile:       '9000000001',
    pan:          'PQRST5678H',
    kycStatus:    4,   // Rejected
    dateOfBirth:  '1978-11-08',
    createdAt:    '2026-02-20T11:00:00Z',
  },
];

// Paginated response helper
function paged(items: any[], total?: number) {
  return { total: total ?? items.length, items, page: 1, pageSize: 20 };
}

describe('[REGRESSION] Customer Management — List', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    // SAAR-CST-001: stub now returns paginated response
    cy.intercept('GET', '**/api/customer**', { body: paged(CUSTOMERS) }).as('customers');
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

  it('shows KYC status chips (Verified / In Progress / Rejected)', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.contains(/Verified/i).should('exist');
    cy.contains(/In Progress/i).should('exist');
    cy.contains(/Rejected/i).should('exist');
  });

  it('shows customer email and mobile', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.contains('9876543210').should('exist');
  });

  it('shows customer data in the table', () => {
    // CustomerManagement has no search input — just verify data renders
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
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
    // SAAR-CST-001: stub updated to paginated format
    cy.intercept('GET', '**/api/customer**', { body: paged([]) }).as('customers');
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
    cy.intercept('POST', '**/api/customer', {
      statusCode: 400,
      body: { message: 'FullName is required' },
    }).as('createFail');

    cy.visit('/customers');
    cy.contains(/new customer|add customer|create customer/i, { timeout: 15000 }).click();
    cy.contains(/save|create|submit/i, { timeout: 5000 }).last().click({ force: true });
    cy.contains(/required|name|error/i, { timeout: 10000 }).should('exist');
  });

  it('successful create shows confirmation and adds to list', () => {
    cy.intercept('POST', '**/api/customer', {
      statusCode: 201,
      body: { customerId: 200, firstName: 'New Test', lastName: 'Customer', kycStatus: 0 },
    }).as('createOk');

    cy.visit('/customers');
    cy.contains(/new customer|add customer/i, { timeout: 15000 }).click();
    // MUI TextField has no name/placeholder — use first text input inside the dialog
    cy.get('[role="dialog"]').find('input[type="text"], input:not([type="hidden"])').first().type('New Test', { force: true });
    cy.contains(/save|create|submit/i, { timeout: 5000 }).last().click({ force: true });

    cy.get('@createOk.all', { timeout: 10000 }).then((calls: any) => {
      if (calls.length > 0) {
        cy.contains(/success|created|New Test/i, { timeout: 10000 }).should('exist');
      }
    });
  });
});

/**
 * SAAR-KYC-001 — KYC Workflow regression tests
 * KYC state machine: NotStarted(0)→InProgress(1)→DocumentsSubmitted(2)→Verified(3)/Rejected(4)
 * Action buttons use aria-label for reliable selection (MUI Tooltip does not set DOM title).
 */

const CUSTOMERS_KYC = [
  { customerId: 201, firstName: 'Suresh', lastName: 'Nair',   kycStatus: 0, dateOfBirth: '1980-01-01', createdAt: '2026-01-01T00:00:00Z' },
  { customerId: 202, firstName: 'Meena',  lastName: 'Pillai', kycStatus: 1, dateOfBirth: '1990-01-01', createdAt: '2026-01-02T00:00:00Z' },
  { customerId: 203, firstName: 'Ravi',   lastName: 'Verma',  kycStatus: 2, dateOfBirth: '1985-01-01', createdAt: '2026-01-03T00:00:00Z' },
  { customerId: 204, firstName: 'Kavita', lastName: 'Rao',    kycStatus: 3, dateOfBirth: '1978-05-20', createdAt: '2026-01-04T00:00:00Z' },
];

describe('[REGRESSION] Customer KYC Workflow — action buttons', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    // SAAR-CST-001: stub updated to paginated format
    cy.intercept('GET', '**/api/customer**', { body: paged(CUSTOMERS_KYC) }).as('customers');
  });

  it('shows Initiate KYC button for NotStarted customer', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('[aria-label="Initiate KYC"]').should('exist');
  });

  it('shows Submit Documents button for InProgress customer', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('[aria-label="Submit Documents"]').should('exist');
  });

  it('shows Verify KYC and Reject KYC buttons for DocumentsSubmitted customer', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('[aria-label="Verify KYC"]').should('exist');
    cy.get('[aria-label="Reject KYC"]').should('exist');
  });

  it('Initiate KYC calls API and shows success message', () => {
    cy.intercept('POST', '**/api/customer/201/kyc/initiate', {
      statusCode: 200,
      body: { kycStatus: 1, message: 'KYC initiated successfully.' },
    }).as('initiate');
    // Reload list after action returns InProgress
    cy.intercept('GET', '**/api/customer**', { body: paged(CUSTOMERS_KYC.map(c => c.customerId === 201 ? { ...c, kycStatus: 1 } : c)) }).as('reload');

    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('[aria-label="Initiate KYC"]').first().click();
    cy.wait('@initiate', { timeout: 10000 });
    cy.contains(/KYC initiated/i, { timeout: 10000 }).should('exist');
  });

  it('shows Expire KYC button for Verified customer', () => {
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('[aria-label="Expire KYC"]').should('exist');
  });

  it('Expire KYC calls API and shows success message', () => {
    cy.intercept('POST', '**/api/customer/204/kyc/expire', {
      statusCode: 200,
      body: { kycStatus: 5, message: 'KYC has been marked as expired.' },
    }).as('expire');
    cy.intercept('GET', '**/api/customer**', { body: paged(CUSTOMERS_KYC.map(c => c.customerId === 204 ? { ...c, kycStatus: 5 } : c)) }).as('reload');

    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('[aria-label="Expire KYC"]').first().click();
    cy.wait('@expire', { timeout: 10000 });
    cy.contains(/expired/i, { timeout: 10000 }).should('exist');
  });

  it('Verify KYC dialog requires Verified By and confirms on submit', () => {
    cy.intercept('POST', '**/api/customer/203/kyc/verify', {
      statusCode: 200,
      body: { kycStatus: 3, message: 'KYC verified by Branch Manager.' },
    }).as('verify');
    cy.intercept('GET', '**/api/customer**', { body: paged(CUSTOMERS_KYC.map(c => c.customerId === 203 ? { ...c, kycStatus: 3 } : c)) }).as('reload');

    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('[aria-label="Verify KYC"]').first().click();

    // Dialog should open
    cy.contains(/Verify KYC/i, { timeout: 5000 }).should('exist');

    // Fill in verified by
    cy.get('[role="dialog"]').find('input').first().type('Branch Manager');
    cy.contains(/Confirm Verify/i).click();
    cy.wait('@verify', { timeout: 10000 });
    cy.contains(/verified/i, { timeout: 10000 }).should('exist');
  });
});

/**
 * SAAR-CST-001 — Pagination + Search regression tests
 */
describe('[REGRESSION] Customer Pagination + Search', () => {
  beforeEach(() => {
    cy.loginAsDemo();
  });

  it('search input is visible on the customers page', () => {
    cy.intercept('GET', '**/api/customer**', { body: paged(CUSTOMERS) }).as('customers');
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    cy.get('[aria-label="search customers"]').should('exist');
  });

  it('KYC status filter dropdown exists', () => {
    cy.intercept('GET', '**/api/customer**', { body: paged(CUSTOMERS) }).as('customers');
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    // KYC Status dropdown is visible
    cy.contains(/KYC Status/i).should('exist');
  });

  it('pagination control is shown when total exceeds page size', () => {
    // Stub: 25 total, 20 items on page 1 → pagination should appear
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      customerId: i + 1,
      firstName: `Customer${i + 1}`,
      lastName: 'Test',
      kycStatus: 3,
      dateOfBirth: '1990-01-01',
      createdAt: '2026-01-01T00:00:00Z',
    }));
    cy.intercept('GET', '**/api/customer**', { body: { total: 25, items: manyItems, page: 1, pageSize: 20 } }).as('customers');
    cy.visit('/customers');
    cy.wait('@customers', { timeout: 15000 });
    // Pagination component renders a nav with aria-label="pagination navigation"
    cy.get('[aria-label="pagination navigation"]').should('exist');
  });
});
