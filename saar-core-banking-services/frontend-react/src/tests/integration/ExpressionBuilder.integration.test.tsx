import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SimpleExpressionBuilder from '../../pages/SimpleExpressionBuilder';

// Mock the fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock successful API responses
const mockExpressionsResponse = {
  expressions: [
    {
      id: '1',
      expressionId: 'EXPR_TEST_001',
      name: 'Test Expression',
      description: 'A test expression',
      category: 'loan',
      subCategory: 'eligibility',
      expressionText: 'customer.CreditScore > 700',
      returnType: 'boolean',
      contextType: 'Customer',
      usageType: 'Validation',
      isActive: true,
      createdAt: '2025-08-15T10:00:00Z',
      updatedAt: '2025-08-15T10:00:00Z'
    }
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    hasNext: false,
    total: 1
  }
};

// Test wrapper component 
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    {children}
  </>
);

describe('Expression Builder Integration Tests', () => {
  // Prevent jsdom from throwing on alert calls used by the page under test
  beforeAll(() => {
    // @ts-ignore
    window.alert = jest.fn();
  });

  beforeEach(() => {
    mockFetch.mockClear();
    // Default mock for GET expressions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockExpressionsResponse
    });
  });

  describe('Component Loading', () => {
    test('should render the expression builder interface', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <SimpleExpressionBuilder />
          </TestWrapper>
        );
      });

      // Check if main heading is present
      expect(screen.getByText('Expression Builder')).toBeInTheDocument();
      expect(screen.getByText('Create, edit, and test business rule expressions for banking operations.')).toBeInTheDocument();

      // Check if tabs are present
      expect(screen.getByText('Expressions')).toBeInTheDocument();
      expect(screen.getByText('Create/Edit')).toBeInTheDocument();
      expect(screen.getByText('Templates')).toBeInTheDocument();
      expect(screen.getByText('Functions')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should load and display existing expressions', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <SimpleExpressionBuilder />
          </TestWrapper>
        );
      });

      // Wait for expressions to load
      await waitFor(() => {
        expect(screen.getByText('Test Expression')).toBeInTheDocument();
      });

      expect(screen.getByText('A test expression')).toBeInTheDocument();
      expect(screen.getByText('loan')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    test('should navigate between tabs correctly', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <SimpleExpressionBuilder />
          </TestWrapper>
        );
      });

      // Initially on Expressions tab
      expect(screen.getByText('Expression List')).toBeInTheDocument();

      // Click Templates tab
      const templatesTab = screen.getByText('Templates');
      await act(async () => {
        await userEvent.click(templatesTab);
      });
      
      expect(screen.getByRole('heading', { name: /Expression Templates/i })).toBeInTheDocument();

      // Click Functions tab
      const functionsTab = screen.getByText('Functions');
      await act(async () => {
        await userEvent.click(functionsTab);
      });
      
      expect(screen.getByText(/Banking Functions & Operators/i)).toBeInTheDocument();

      // Click Test tab
      const testTab = screen.getByText('Test');
      await act(async () => {
        await userEvent.click(testTab);
      });
      
      expect(screen.getByText(/Expression Tester/i)).toBeInTheDocument();
    });
  });

  describe('Expression Creation', () => {
    test('should successfully create a new expression with all required fields', async () => {
      // Mock successful POST response for creating expression
      mockFetch.mockReset();
      // First call - load existing expressions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockExpressionsResponse
      });
      // Second call - create new expression
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '2',
          expressionId: 'EXPR_TEST_002',
          name: 'New Test Expression',
          description: 'A new test expression created via form',
      category: 'loan',
          subCategory: 'account',
          expression: 'customer.age >= 18',
          returnType: 'boolean',
          contextType: 'Customer',
          usageType: 'Validation',
          isActive: true,
          createdAt: '2025-08-15T11:00:00Z',
          updatedAt: '2025-08-15T11:00:00Z'
        })
      });
      // Third call - reload expressions after successful create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          expressions: [
            ...mockExpressionsResponse.expressions,
            {
              id: '2',
              expressionId: 'EXPR_TEST_002',
              name: 'New Test Expression',
              description: 'A new test expression created via form',
              category: 'loan',
              subCategory: 'account',
              expressionText: 'customer.age >= 18',
              returnType: 'boolean',
              contextType: 'Customer',
              usageType: 'Validation',
              isActive: true,
              createdAt: '2025-08-15T11:00:00Z',
              updatedAt: '2025-08-15T11:00:00Z'
            }
          ],
          pagination: { page: 1, pageSize: 20, hasNext: false, total: 2 }
        })
      });

      await act(async () => {
        render(
          <TestWrapper>
            <SimpleExpressionBuilder />
          </TestWrapper>
        );
      });

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Expression Builder')).toBeInTheDocument();
      });

      // Navigate to Create/Edit tab
      const createTab = screen.getByText('Create/Edit');
      await act(async () => {
        await userEvent.click(createTab);
      });

      // Verify we're on the Create/Edit tab
      expect(screen.getByText('Create/Edit Expression')).toBeInTheDocument();

      // Fill in all required fields
      const nameInput = screen.getByPlaceholderText(/Enter expression name/i);
      await act(async () => {
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'New Test Expression');
      });

      const descriptionTextarea = screen.getByPlaceholderText(/Describe what this expression does/i);
      await act(async () => {
        await userEvent.clear(descriptionTextarea);
        await userEvent.type(descriptionTextarea, 'A new test expression created via form');
      });

      const categorySelect = screen.getByDisplayValue('Select a category');
      await act(async () => {
        // Choose an existing option from the UI (e.g., 'loan')
        await userEvent.selectOptions(categorySelect, 'loan');
      });

      const expressionTextarea = screen.getByPlaceholderText(/Example: IF\(customer\.creditScore/);
      await act(async () => {
        await userEvent.clear(expressionTextarea);
        await userEvent.type(expressionTextarea, 'customer.age >= 18');
      });

      const contextTypeSelect = screen.getByDisplayValue('Select context type');
      await act(async () => {
        await userEvent.selectOptions(contextTypeSelect, 'Customer');
      });

      const usageTypeSelect = screen.getByDisplayValue('Select usage type');
      await act(async () => {
        await userEvent.selectOptions(usageTypeSelect, 'Validation');
      });

      // Submit the form
      const createButton = screen.getByText('Create Expression');
      expect(createButton).not.toBeDisabled();
      
      await act(async () => {
        await userEvent.click(createButton);
      });

      // Verify API was called with correct data
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/expressions'),
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('New Test Expression')
          })
        );
      });
    });

    test('should validate required fields before submission', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <SimpleExpressionBuilder />
          </TestWrapper>
        );
      });

      // Navigate to Create/Edit tab
      const createTab = screen.getByText('Create/Edit');
      await act(async () => {
        await userEvent.click(createTab);
      });

      // Try to submit without filling required fields
      const createButton = screen.getByText('Create Expression');
      
      // Button should be disabled when required fields are empty
      expect(createButton).toBeDisabled();

      // Fill only the name field
      const nameInput = screen.getByPlaceholderText(/Enter expression name/i);
      await act(async () => {
        await userEvent.type(nameInput, 'Test Name');
      });

      // Button should still be disabled without expression
      expect(createButton).toBeDisabled();

      // Fill the expression field
      const expressionTextarea = screen.getByPlaceholderText(/Example: IF\(customer\.creditScore/);
      await act(async () => {
        await userEvent.type(expressionTextarea, 'customer.age >= 18');
      });

      // Now button should be enabled
      expect(createButton).not.toBeDisabled();
    });

    test('should handle expression creation errors', async () => {
      // Mock failed POST response
      mockFetch.mockReset();
      // First call - load existing expressions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockExpressionsResponse
      });
      // Second call - failed create
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation failed',
          message: 'Expression name already exists'
        })
      });

      await act(async () => {
        render(
          <TestWrapper>
            <SimpleExpressionBuilder />
          </TestWrapper>
        );
      });

      // Navigate to Create/Edit tab
      const createTab = screen.getByText('Create/Edit');
      await act(async () => {
        await userEvent.click(createTab);
      });

      // Fill required fields
      const nameInput = screen.getByPlaceholderText(/Enter expression name/i);
      await act(async () => {
        await userEvent.type(nameInput, 'Duplicate Name');
      });

      const expressionTextarea = screen.getByPlaceholderText(/Example: IF\(customer\.creditScore/);
      await act(async () => {
        await userEvent.type(expressionTextarea, 'customer.age >= 18');
      });

      // Submit the form
      const createButton = screen.getByText('Create Expression');
      await act(async () => {
        await userEvent.click(createButton);
      });

      // Should trigger an alert error; verify alert was called
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalled();
        expect((window.alert as jest.Mock).mock.calls[0][0]).toMatch(/Error creating expression/i);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle API fetch errors gracefully', async () => {
      // Mock fetch to reject
      mockFetch.mockReset();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(
          <TestWrapper>
            <SimpleExpressionBuilder />
          </TestWrapper>
        );
      });

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/Failed to load expressions/i)).toBeInTheDocument();
      });
    });

    test('should handle empty expressions response', async () => {
      // Mock empty response
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          expressions: [],
          pagination: { page: 1, pageSize: 20, hasNext: false, total: 0 }
        })
      });

      await act(async () => {
        render(
          <TestWrapper>
            <SimpleExpressionBuilder />
          </TestWrapper>
        );
      });

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Expression List')).toBeInTheDocument();
      });

      // Should show empty state (no expressions table)
      expect(screen.queryByText('Test Expression')).not.toBeInTheDocument();
    });
  });
});
