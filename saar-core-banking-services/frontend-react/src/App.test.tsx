import React from 'react';
import { render } from '@testing-library/react';

// Mock ESM-only modules before importing App
jest.mock(
  'react-router-dom',
  () => ({
    BrowserRouter: ({ children }: any) => <div>{children}</div>,
  }),
  { virtual: true }
);

// Mock the internal AppRouter to a simple stub to avoid deep routing dependencies
jest.mock('./router/AppRouter', () => ({
  AppRouter: () => <div data-testid="app-router" />,
}));

jest.mock(
  'react-error-boundary',
  () => ({
    ErrorBoundary: ({ children }: any) => <>{children}</>,
  }),
  { virtual: true }
);

jest.mock(
  '@tanstack/react-query-devtools',
  () => ({
    ReactQueryDevtools: () => null,
  }),
  { virtual: true }
);

// Import App after mocks so they take effect
// eslint-disable-next-line @typescript-eslint/no-var-requires
const App = require('./App').default as React.ComponentType;

test('App renders without crashing', () => {
  render(<App />);
  expect(true).toBe(true);
});
