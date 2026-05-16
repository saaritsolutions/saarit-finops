/// <reference types="cypress" />

/**
 * BUGFIX: KYC Document Upload Workflow
 * Tests for customer KYC document upload, validation, and status transitions
 */

describe('[REGRESSION] KYC Document Upload Workflow', () => {
  // Mock file for testing
  const mockPdfFile = { fileName: 'pan_card.pdf', mimeType: 'application/pdf' };
  const mockJpgFile = { fileName: 'aadhar_card.jpg', mimeType: 'image/jpeg' };

  // ────────────────────────────────────────────────────────────────────────────
  // T-01: Customer Management page loads with KYC workflow buttons
  // ────────────────────────────────────────────────────────────────────────────
  it('T-01: Customer Management page loads and displays KYC workflow buttons', () => {
    cy.loginAsDemo();

    // Mock customer list
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 1,
            firstName: 'John',
            lastName: 'Doe',
            mobile: '9876543210',
            email: 'john@example.com',
            pan: 'ABCDE1234F',
            kycStatus: 0,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    // Check page header
    cy.contains('Customer Management').should('be.visible');

    // Check customer row is displayed
    cy.contains('John Doe').should('be.visible');

    // Check KYC status is "Not Started"
    cy.contains('Not Started').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-02: Initiate KYC button transitions status from NotStarted to InProgress
  // ────────────────────────────────────────────────────────────────────────────
  it('T-02: Initiate KYC transitions status from NotStarted to InProgress', () => {
    cy.loginAsDemo();

    // Mock customer list with NotStarted status
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 1,
            firstName: 'Jane',
            lastName: 'Smith',
            kycStatus: 0,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomersInit');

    // Mock initiate KYC endpoint
    cy.intercept('POST', '**/api/customer/1/kyc/initiate', {
      statusCode: 200,
      body: { kycStatus: 1, message: 'KYC initiated successfully.' },
    }).as('initiateKyc');

    // Mock customer list after status change
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 1,
            firstName: 'Jane',
            lastName: 'Smith',
            kycStatus: 1,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomersAfterInit');

    cy.visit('/customers');
    cy.wait('@getCustomersInit');

    // Find and click Initiate KYC button (PlayArrow icon)
    cy.contains('td', 'Jane Smith').parent().find('[aria-label="Initiate KYC"]').click();

    cy.wait('@initiateKyc');
    cy.wait('@getCustomersAfterInit');

    // Check success message
    cy.contains('KYC initiated successfully').should('be.visible');

    // Check status changed to "In Progress"
    cy.contains('In Progress').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-03: Upload Documents button opens KYC document dialog
  // ────────────────────────────────────────────────────────────────────────────
  it('T-03: Upload Documents button opens document dialog with checklist', () => {
    cy.loginAsDemo();

    // Mock customer in InProgress status
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 2,
            firstName: 'Bob',
            lastName: 'Johnson',
            kycStatus: 1,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomersInProgress');

    cy.visit('/customers');
    cy.wait('@getCustomersInProgress');

    // Find and click Upload Documents button (UploadFile icon)
    cy.contains('td', 'Bob Johnson').parent().find('[aria-label="Upload Documents"]').click();

    // Check dialog opens
    cy.contains('KYC Document Upload').should('be.visible');

    // Check document checklist is displayed
    cy.contains('PAN Card').should('be.visible');
    cy.contains('Aadhaar Card').should('be.visible');
    cy.contains('Identity Proof').should('be.visible');
    cy.contains('Address Proof').should('be.visible');

    // Check upload progress bar
    cy.contains('Required Documents:').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-04: Document upload validates file type and size
  // ────────────────────────────────────────────────────────────────────────────
  it('T-04: Document upload validates file type and shows error for invalid files', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 3,
            firstName: 'Alice',
            lastName: 'Williams',
            kycStatus: 1,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    cy.contains('td', 'Alice Williams').parent().find('[aria-label="Upload Documents"]').click();

    // Check dialog is open
    cy.contains('KYC Document Upload').should('be.visible');

    // Try to upload a PDF file for PAN Card
    cy.contains('PAN Card').parent().find('input[type="file"]').attachFile(mockPdfFile);

    // File should be selected
    cy.contains('PAN Card').parent().should('contain', 'pan_card.pdf');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-05: Save Documents button saves without submitting (stays in InProgress)
  // ────────────────────────────────────────────────────────────────────────────
  it('T-05: Save Documents button saves without submitting', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 4,
            firstName: 'Charlie',
            lastName: 'Brown',
            kycStatus: 1,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    // Mock document upload endpoint
    cy.intercept('POST', '**/api/customer/4/documents/upload', {
      statusCode: 200,
      body: { message: 'Document uploaded successfully.' },
    }).as('uploadDoc');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    cy.contains('td', 'Charlie Brown').parent().find('[aria-label="Upload Documents"]').click();

    // Attach a file
    cy.contains('PAN Card').parent().find('input[type="file"]').attachFile(mockPdfFile);

    // Mock customer list after save (still InProgress)
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 4,
            firstName: 'Charlie',
            lastName: 'Brown',
            kycStatus: 1,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomersAfterSave');

    // Click "Save Documents" button (not "Upload & Submit")
    cy.contains('button', 'Save Documents').click();

    cy.wait('@uploadDoc');
    cy.wait('@getCustomersAfterSave');

    // Check success message
    cy.contains('Documents saved').should('be.visible');

    // Dialog should close
    cy.contains('KYC Document Upload').should('not.exist');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-06: Upload & Submit button submits all documents and changes status
  // ────────────────────────────────────────────────────────────────────────────
  it('T-06: Upload & Submit button transitions to DocumentsSubmitted status', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 5,
            firstName: 'David',
            lastName: 'Miller',
            kycStatus: 1,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    // Mock all document uploads
    cy.intercept('POST', '**/api/customer/5/documents/upload', {
      statusCode: 200,
      body: { message: 'Document uploaded successfully.' },
    }).as('uploadDocs');

    // Mock submit documents endpoint
    cy.intercept('POST', '**/api/customer/5/kyc/submit-documents', {
      statusCode: 200,
      body: { kycStatus: 2, message: 'Documents submitted for KYC review.' },
    }).as('submitKyc');

    // Mock customer list after submit (status = DocumentsSubmitted)
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 5,
            firstName: 'David',
            lastName: 'Miller',
            kycStatus: 2,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomersAfterSubmit');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    cy.contains('td', 'David Miller').parent().find('[aria-label="Upload Documents"]').click();

    // Upload all 4 required documents
    cy.contains('PAN Card').parent().find('input[type="file"]').attachFile(mockPdfFile);
    cy.contains('Aadhaar Card').parent().find('input[type="file"]').attachFile(mockJpgFile);
    cy.contains('Identity Proof').parent().find('input[type="file"]').attachFile(mockPdfFile);
    cy.contains('Address Proof').parent().find('input[type="file"]').attachFile(mockPdfFile);

    // Click "Upload & Submit" button (should only appear when all required docs uploaded)
    cy.contains('button', 'Upload & Submit').should('be.enabled').click();

    cy.wait('@uploadDocs');
    cy.wait('@submitKyc');
    cy.wait('@getCustomersAfterSubmit');

    // Check success message
    cy.contains('Documents submitted successfully').should('be.visible');

    // Check status changed to "Docs Submitted"
    cy.contains('Docs Submitted').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-07: Back to In Progress button reverts submitted documents
  // ────────────────────────────────────────────────────────────────────────────
  it('T-07: Back to In Progress button reverts from DocumentsSubmitted to InProgress', () => {
    cy.loginAsDemo();

    // Mock customer in DocumentsSubmitted status
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 6,
            firstName: 'Emma',
            lastName: 'Taylor',
            kycStatus: 2,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    // Mock mark incomplete endpoint
    cy.intercept('POST', '**/api/customer/6/kyc/mark-incomplete', {
      statusCode: 200,
      body: { kycStatus: 1, message: 'KYC marked as incomplete. Please re-upload documents.' },
    }).as('markIncomplete');

    // Mock customer list after revert
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 6,
            firstName: 'Emma',
            lastName: 'Taylor',
            kycStatus: 1,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomersAfterRevert');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    // Check that "Docs Submitted" status is showing
    cy.contains('Docs Submitted').should('be.visible');

    // Find and click "Back to In Progress" button (RestartAlt icon)
    cy.contains('td', 'Emma Taylor').parent().find('[aria-label="Back to In Progress"]').click();

    // Confirm the action in dialog
    cy.on('window:confirm', () => true);

    cy.wait('@markIncomplete');
    cy.wait('@getCustomersAfterRevert');

    // Check success message
    cy.contains('KYC marked as incomplete').should('be.visible');

    // Check status reverted to "In Progress"
    cy.contains('In Progress').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-08: Verify KYC button appears only for DocumentsSubmitted status
  // ────────────────────────────────────────────────────────────────────────────
  it('T-08: Verify and Reject KYC buttons appear only for DocumentsSubmitted status', () => {
    cy.loginAsDemo();

    // Mock customer in DocumentsSubmitted status
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 7,
            firstName: 'Frank',
            lastName: 'Garcia',
            kycStatus: 2,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    // Check that Verify (checkmark) button is visible
    cy.contains('td', 'Frank Garcia').parent().find('[aria-label="Verify KYC"]').should('be.visible');

    // Check that Reject (X) button is visible
    cy.contains('td', 'Frank Garcia').parent().find('[aria-label="Reject KYC"]').should('be.visible');

    // Check that Back to In Progress button is visible
    cy.contains('td', 'Frank Garcia').parent().find('[aria-label="Back to In Progress"]').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-09: Verify KYC transitions to Verified status
  // ────────────────────────────────────────────────────────────────────────────
  it('T-09: Verify KYC transitions to Verified status', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 8,
            firstName: 'Grace',
            lastName: 'Lee',
            kycStatus: 2,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    // Mock verify KYC endpoint
    cy.intercept('POST', '**/api/customer/8/kyc/verify', {
      statusCode: 200,
      body: { kycStatus: 3, message: 'KYC verified by Officer123.' },
    }).as('verifyKyc');

    // Mock customer list after verification
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 8,
            firstName: 'Grace',
            lastName: 'Lee',
            kycStatus: 3,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomersAfterVerify');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    // Click Verify KYC button
    cy.contains('td', 'Grace Lee').parent().find('[aria-label="Verify KYC"]').click();

    // Dialog should open
    cy.contains('Verify KYC').should('be.visible');

    // Enter verified by name
    cy.get('input[placeholder*="Officer"]').type('Officer123');

    // Click confirm
    cy.contains('button', 'Confirm Verify').click();

    cy.wait('@verifyKyc');
    cy.wait('@getCustomersAfterVerify');

    // Check success message
    cy.contains('KYC verified by Officer123').should('be.visible');

    // Check status changed to "Verified"
    cy.contains('Verified').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-10: Reject KYC transitions to Rejected status
  // ────────────────────────────────────────────────────────────────────────────
  it('T-10: Reject KYC transitions to Rejected status', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 9,
            firstName: 'Henry',
            lastName: 'Martinez',
            kycStatus: 2,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    // Mock reject KYC endpoint
    cy.intercept('POST', '**/api/customer/9/kyc/reject', {
      statusCode: 200,
      body: { kycStatus: 4, message: 'KYC rejected.' },
    }).as('rejectKyc');

    // Mock customer list after rejection
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 9,
            firstName: 'Henry',
            lastName: 'Martinez',
            kycStatus: 4,
            customerType: 'Individual',
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomersAfterReject');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    // Click Reject KYC button
    cy.contains('td', 'Henry Martinez').parent().find('[aria-label="Reject KYC"]').click();

    // Dialog should open
    cy.contains('Reject KYC').should('be.visible');

    // Enter rejection reason
    cy.get('textarea').type('Documents incomplete - missing address proof');

    // Click confirm
    cy.contains('button', 'Confirm Reject').click();

    cy.wait('@rejectKyc');
    cy.wait('@getCustomersAfterReject');

    // Check success message
    cy.contains('KYC rejected').should('be.visible');

    // Check status changed to "Rejected"
    cy.contains('Rejected').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-11: Document checklist varies by customer type
  // ────────────────────────────────────────────────────────────────────────────
  it('T-11: Document checklist varies based on customer type (Corporate)', () => {
    cy.loginAsDemo();

    // Mock corporate customer in InProgress status
    cy.intercept('GET', '**/api/customer*', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            customerId: 10,
            firstName: 'Acme',
            lastName: 'Corp',
            customerType: 'Corporate',
            kycStatus: 1,
            createdAt: '2026-05-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    }).as('getCustomers');

    cy.visit('/customers');
    cy.wait('@getCustomers');

    cy.contains('td', 'Acme Corp').parent().find('[aria-label="Upload Documents"]').click();

    // Check dialog opens
    cy.contains('KYC Document Upload').should('be.visible');

    // Check corporate-specific documents are shown
    cy.contains('Company PAN').should('be.visible');
    cy.contains('Certificate of Incorporation').should('be.visible');
    cy.contains('Director Identity & Address Proof').should('be.visible');
    cy.contains('Director PAN').should('be.visible');

    // Individual documents should not be shown
    cy.contains('Aadhaar Card').should('not.exist');
  });
});
