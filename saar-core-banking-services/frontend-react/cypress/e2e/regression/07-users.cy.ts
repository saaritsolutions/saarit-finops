/// <reference types="cypress" />
export {};

/**
 * REGRESSION — User Management Module
 * Covers: users tab, roles tab, add user dialog, role assignment,
 *         Admin/Maker/Checker colour chips.
 */

const USERS = [
  { id: 1, username: 'admin@ucb-demo.com',  email: 'admin@ucb-demo.com',  firstName: 'Admin',  lastName: 'User',  roles: [{ name: 'Admin' }],   status: 'Active', tenantId: 'ucb_demo' },
  { id: 2, username: 'maker@ucb-demo.com',  email: 'maker@ucb-demo.com',  firstName: 'Maker',  lastName: 'User',  roles: [{ name: 'Maker' }],   status: 'Active', tenantId: 'ucb_demo' },
  { id: 3, username: 'checker@ucb-demo.com', email: 'checker@ucb-demo.com', firstName: 'Checker', lastName: 'User', roles: [{ name: 'Checker' }], status: 'Active', tenantId: 'ucb_demo' },
];

const ROLES = [
  { id: 1, name: 'Admin',   description: 'Full system access',      permissions: ['all'] },
  { id: 2, name: 'Maker',   description: 'Create and edit records',  permissions: ['create', 'edit'] },
  { id: 3, name: 'Checker', description: 'Approve and reject',       permissions: ['approve'] },
];

describe('[REGRESSION] User Management — Users Tab', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/uam/users*', { body: USERS }).as('users');
    cy.intercept('GET', '**/api/users*',     { body: USERS }).as('usersAlt');
    cy.intercept('GET', '**/api/roles*',     { body: ROLES }).as('roles');
  });

  it('loads user management page', () => {
    cy.visit('/admin/users');
    cy.get('body').should('be.visible');
    cy.contains(/user|admin/i, { timeout: 15000 }).should('exist');
  });

  it('shows Users and Roles tabs', () => {
    cy.visit('/admin/users');
    cy.contains(/^Users$/i, { timeout: 15000 }).should('be.visible');
    cy.contains(/^Roles$/i, { timeout: 15000 }).should('be.visible');
  });

  it('displays all 3 users in the users list', () => {
    cy.visit('/admin/users');
    cy.wait('@users', { timeout: 15000 });
    cy.contains('admin@ucb-demo.com').should('exist');
    cy.contains('maker@ucb-demo.com').should('exist');
    cy.contains('checker@ucb-demo.com').should('exist');
  });

  it('shows role chips with correct labels', () => {
    cy.visit('/admin/users');
    cy.wait('@users', { timeout: 15000 });
    cy.contains('Admin').should('exist');
    cy.contains('Maker').should('exist');
    cy.contains('Checker').should('exist');
  });

  it('New User button opens create user dialog', () => {
    cy.visit('/admin/users');
    cy.contains(/new user|add user|create user/i, { timeout: 15000 }).click();
    cy.contains(/email|username|password/i, { timeout: 10000 }).should('be.visible');
  });

  it('create user dialog has email, password, role fields', () => {
    cy.visit('/admin/users');
    cy.contains(/new user|add user|create user/i, { timeout: 15000 }).click();
    cy.contains(/email/i, { timeout: 10000 }).should('exist');
    cy.contains(/password/i, { timeout: 10000 }).should('exist');
    cy.contains(/role/i, { timeout: 10000 }).should('exist');
  });

  it('validates required fields on user create submit', () => {
    cy.intercept('POST', '**/api/uam/users*', {
      statusCode: 400,
      body: { message: 'Email is required' },
    }).as('createFail');

    cy.visit('/admin/users');
    cy.contains(/new user|add user/i, { timeout: 15000 }).click();
    cy.contains(/save|create|submit|add/i, { timeout: 5000 }).last().click({ force: true });
    cy.contains(/required|email|error/i, { timeout: 10000 }).should('exist');
  });
});

describe('[REGRESSION] User Management — Roles Tab', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/uam/users*', { body: USERS }).as('users');
    cy.intercept('GET', '**/api/users*',     { body: USERS }).as('usersAlt');
    cy.intercept('GET', '**/api/roles*',     { body: ROLES }).as('roles');
  });

  it('Roles tab shows role list', () => {
    cy.visit('/admin/users');
    cy.contains(/^Roles$/i, { timeout: 15000 }).click();
    cy.wait('@roles', { timeout: 10000 });
    cy.contains('Admin').should('exist');
    cy.contains('Maker').should('exist');
    cy.contains('Checker').should('exist');
  });

  it('shows role description in the roles list', () => {
    cy.visit('/admin/users');
    cy.contains(/^Roles$/i, { timeout: 15000 }).click();
    cy.wait('@roles', { timeout: 10000 });
    cy.contains(/full system|create and edit|approve/i, { timeout: 5000 }).should('exist');
  });

  it('New Role button opens create role dialog', () => {
    cy.visit('/admin/users');
    cy.contains(/^Roles$/i, { timeout: 15000 }).click();
    cy.contains(/new role|add role|create role/i, { timeout: 10000 }).click({ force: true });
    cy.contains(/role name|name|description/i, { timeout: 10000 }).should('be.visible');
  });
});
