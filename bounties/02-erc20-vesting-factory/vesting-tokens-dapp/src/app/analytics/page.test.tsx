import React from 'react';
import { render, screen } from '@testing-library/react';
import AnalyticsPage from './page';

// Helper function to create properly typed mocks
const createMockUseAccount = (overrides: { isConnected?: boolean | null; address?: string; status?: string }) => 
  ({ isConnected: false, address: undefined, status: 'disconnected', ...overrides } as unknown as ReturnType<typeof useAccount>);

// Helper function to safely check DOM hierarchy
const safeToContainElement = (parent: Element | null, child: Element | null) => {
  if (!parent || !child) return false;
  return (parent as unknown as { toContainElement: (el: Element) => boolean }).toContainElement(child);
};

// Mock the dependencies
jest.mock('wagmi', () => ({
  useAccount: jest.fn()
}));

jest.mock('@/components/layout/navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>
}));

jest.mock('@/components/web3/connect-wallet-prompt', () => ({
  ConnectWalletPrompt: () => <div data-testid="connect-wallet-prompt">Connect Wallet Prompt</div>
}));

jest.mock('@/components/analytics/analytics-overview', () => ({
  AnalyticsOverview: () => <div data-testid="analytics-overview">Analytics Overview</div>
}));

jest.mock('@/components/analytics/tokens-list', () => ({
  TokensList: () => <div data-testid="tokens-list">Tokens List</div>
}));

import { useAccount } from 'wagmi';

const mockUseAccount = jest.mocked(useAccount);

describe('AnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render connect wallet prompt when not connected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: false }));

    render(<AnalyticsPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tokens-list')).not.toBeInTheDocument();
  });

  it('should render analytics content when connected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    render(<AnalyticsPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tokens-list')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should render analytics page title and description when connected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    render(<AnalyticsPage />);

    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Monitor your token deployments and vesting performance')).toBeInTheDocument();
  });

  it('should have correct CSS classes when connected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    const { container } = render(<AnalyticsPage />);

    const mainContainer = container.querySelector('.container');
    expect(mainContainer).toHaveClass('container', 'mx-auto', 'px-4', 'py-8');

    const titleContainer = container.querySelector('.mb-8');
    expect(titleContainer).toBeInTheDocument();

    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-3xl', 'font-bold', 'mb-2');

    const description = container.querySelector('p');
    expect(description).toHaveClass('text-muted-foreground');

    const contentContainer = container.querySelector('.space-y-8');
    expect(contentContainer).toBeInTheDocument();
  });

  it('should handle undefined isConnected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: undefined }));

    render(<AnalyticsPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tokens-list')).not.toBeInTheDocument();
  });

  it('should handle null isConnected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: null }));

    render(<AnalyticsPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tokens-list')).not.toBeInTheDocument();
  });

  it('should render consistently across multiple renders', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    const { rerender } = render(<AnalyticsPage />);

    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tokens-list')).toBeInTheDocument();

    rerender(<AnalyticsPage />);

    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tokens-list')).toBeInTheDocument();
  });

  it('should handle connection state changes', () => {
    const { rerender } = render(<AnalyticsPage />);

    // Initially not connected
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: false }));
    rerender(<AnalyticsPage />);

    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tokens-list')).not.toBeInTheDocument();

    // Then connected
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));
    rerender(<AnalyticsPage />);

    expect(screen.getByTestId('analytics-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tokens-list')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should maintain proper component hierarchy when connected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    const { container } = render(<AnalyticsPage />);

    const navbar = container.querySelector('[data-testid="navbar"]');
    const mainContainer = container.querySelector('.container');
    const contentContainer = container.querySelector('.space-y-8');
    const analyticsOverview = container.querySelector('[data-testid="analytics-overview"]');
    const tokensList = container.querySelector('[data-testid="tokens-list"]');

    expect(navbar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();
    expect(contentContainer).toBeInTheDocument();
    expect(analyticsOverview).toBeInTheDocument();
    expect(tokensList).toBeInTheDocument();

    // Check hierarchy
    expect(safeToContainElement(container.querySelector('[data-testid="navbar"]'), navbar)).toBe(true);
    expect(safeToContainElement(container.querySelector('.container'), mainContainer)).toBe(true);
    expect(safeToContainElement(mainContainer, contentContainer)).toBe(true);
    expect(safeToContainElement(contentContainer, analyticsOverview)).toBe(true);
    expect(safeToContainElement(contentContainer, tokensList)).toBe(true);
  });

  it('should maintain proper component hierarchy when not connected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: false }));

    const { container } = render(<AnalyticsPage />);

    const navbar = container.querySelector('[data-testid="navbar"]');
    const connectPrompt = container.querySelector('[data-testid="connect-wallet-prompt"]');

    expect(navbar).toBeInTheDocument();
    expect(connectPrompt).toBeInTheDocument();

    // Check hierarchy
    expect(safeToContainElement(container.children[0], navbar)).toBe(true);
    expect(safeToContainElement(container.children[1], connectPrompt)).toBe(true);
  });

  it('should render without errors', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    expect(() => render(<AnalyticsPage />)).not.toThrow();
  });

  it('should handle missing useAccount hook gracefully', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({}));

    render(<AnalyticsPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
  });

  it('should have proper semantic structure', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    const { container } = render(<AnalyticsPage />);

    const title = container.querySelector('h1');
    const description = container.querySelector('p');

    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(title?.textContent).toBe('Analytics');
    expect(description?.textContent).toBe('Monitor your token deployments and vesting performance');
  });

  it('should handle empty isConnected object', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({}));

    render(<AnalyticsPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tokens-list')).not.toBeInTheDocument();
  });

  it('should render analytics components in correct order', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    const { container } = render(<AnalyticsPage />);

    const contentContainer = container.querySelector('.space-y-8');
    const analyticsOverview = container.querySelector('[data-testid="analytics-overview"]');
    const tokensList = container.querySelector('[data-testid="tokens-list"]');

    expect(contentContainer).toBeInTheDocument();
    expect(analyticsOverview).toBeInTheDocument();
    expect(tokensList).toBeInTheDocument();

    // Check that analytics overview comes before tokens list
    expect(safeToContainElement(contentContainer?.children[0] || null, analyticsOverview)).toBe(true);
    expect(safeToContainElement(contentContainer?.children[1] || null, tokensList)).toBe(true);
  });

  it('should have proper spacing between components', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: true }));

    const { container } = render(<AnalyticsPage />);

    const contentContainer = container.querySelector('.space-y-8');
    expect(contentContainer).toHaveClass('space-y-8');
  });
});
