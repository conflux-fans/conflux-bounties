import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

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

jest.mock('@/components/dashboard/AdminTokenManagement', () => ({
  AdminTokenManagement: () => <div data-testid="admin-token-management">Admin Token Management</div>
}));

import { useAccount } from 'wagmi';

const mockUseAccount = jest.mocked(useAccount);

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render connect wallet prompt when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false });

    render(<DashboardPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-token-management')).not.toBeInTheDocument();
  });

  it('should render dashboard content when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    render(<DashboardPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('admin-token-management')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should render dashboard title and description when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Manage your token deployments and vesting schedules')).toBeInTheDocument();
  });

  it('should have correct CSS classes when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<DashboardPage />);

    const mainContainer = container.querySelector('.container');
    expect(mainContainer).toHaveClass('container', 'mx-auto', 'px-4', 'py-8');

    const titleContainer = container.querySelector('.mb-8');
    expect(titleContainer).toBeInTheDocument();

    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-3xl', 'font-bold', 'mb-2');

    const description = container.querySelector('p');
    expect(description).toHaveClass('text-muted-foreground');
  });

  it('should handle undefined isConnected', () => {
    mockUseAccount.mockReturnValue({ isConnected: undefined });

    render(<DashboardPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-token-management')).not.toBeInTheDocument();
  });

  it('should handle null isConnected', () => {
    mockUseAccount.mockReturnValue({ isConnected: null });

    render(<DashboardPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-token-management')).not.toBeInTheDocument();
  });

  it('should render consistently across multiple renders', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { rerender } = render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('admin-token-management')).toBeInTheDocument();

    rerender(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('admin-token-management')).toBeInTheDocument();
  });

  it('should handle connection state changes', () => {
    const { rerender } = render(<DashboardPage />);

    // Initially not connected
    mockUseAccount.mockReturnValue({ isConnected: false });
    rerender(<DashboardPage />);

    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-token-management')).not.toBeInTheDocument();

    // Then connected
    mockUseAccount.mockReturnValue({ isConnected: true });
    rerender(<DashboardPage />);

    expect(screen.getByTestId('admin-token-management')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should maintain proper component hierarchy when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<DashboardPage />);

    const navbar = container.querySelector('[data-testid="navbar"]');
    const mainContainer = container.querySelector('.container');
    const adminComponent = container.querySelector('[data-testid="admin-token-management"]');

    expect(navbar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();
    expect(adminComponent).toBeInTheDocument();

    // Check hierarchy
    expect(container.children[0]).toContainElement(navbar);
    expect(container.children[1]).toContainElement(mainContainer);
    expect(mainContainer).toContainElement(adminComponent);
  });

  it('should maintain proper component hierarchy when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false });

    const { container } = render(<DashboardPage />);

    const navbar = container.querySelector('[data-testid="navbar"]');
    const connectPrompt = container.querySelector('[data-testid="connect-wallet-prompt"]');

    expect(navbar).toBeInTheDocument();
    expect(connectPrompt).toBeInTheDocument();

    // Check hierarchy
    expect(container.children[0]).toContainElement(navbar);
    expect(container.children[1]).toContainElement(connectPrompt);
  });

  it('should render without errors', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    expect(() => render(<DashboardPage />)).not.toThrow();
  });

  it('should handle missing useAccount hook gracefully', () => {
    mockUseAccount.mockReturnValue({});

    render(<DashboardPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
  });
});
