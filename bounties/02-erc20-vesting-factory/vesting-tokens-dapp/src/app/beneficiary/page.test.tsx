import React from 'react';
import { render, screen } from '@testing-library/react';
import BeneficiaryPage from './page';

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

jest.mock('@/components/beneficiary/beneficiary-dashboard', () => ({
  BeneficiaryDashboard: () => <div data-testid="beneficiary-dashboard">Beneficiary Dashboard</div>
}));

jest.mock('@/components/beneficiary/vesting-schedules-list', () => ({
  VestingSchedulesList: () => <div data-testid="vesting-schedules-list">Vesting Schedules List</div>
}));

jest.mock('@/components/beneficiary/claim-history', () => ({
  ClaimHistory: () => <div data-testid="claim-history">Claim History</div>
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue, className }: { children: React.ReactNode; defaultValue?: string; className?: string }) => (
    <div data-testid="tabs" data-default-value={defaultValue} className={className}>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-testid={`tab-trigger-${value}`} data-value={value}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`tab-content-${value}`} data-value={value}>
      {children}
    </div>
  )
}));

import { useAccount } from 'wagmi';

const mockUseAccount = jest.mocked(useAccount);

describe('BeneficiaryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render connect wallet prompt when not connected', () => {
    mockUseAccount.mockReturnValue(createMockUseAccount({ isConnected: false }));

    render(<BeneficiaryPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('tabs')).not.toBeInTheDocument();
  });

  it('should render beneficiary content when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    render(<BeneficiaryPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should render beneficiary page title and description when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    render(<BeneficiaryPage />);

    expect(screen.getByText('Beneficiary Portal')).toBeInTheDocument();
    expect(screen.getByText('View and manage your vested tokens')).toBeInTheDocument();
  });

  it('should render all tab triggers when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    render(<BeneficiaryPage />);

    expect(screen.getByTestId('tab-trigger-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-trigger-schedules')).toBeInTheDocument();
    expect(screen.getByTestId('tab-trigger-history')).toBeInTheDocument();

    expect(screen.getByTestId('tab-trigger-overview')).toHaveTextContent('Overview');
    expect(screen.getByTestId('tab-trigger-schedules')).toHaveTextContent('Vesting Schedules');
    expect(screen.getByTestId('tab-trigger-history')).toHaveTextContent('Claim History');
  });

  it('should render all tab content when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    render(<BeneficiaryPage />);

    expect(screen.getByTestId('tab-content-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-content-schedules')).toBeInTheDocument();
    expect(screen.getByTestId('tab-content-history')).toBeInTheDocument();

    expect(screen.getByTestId('beneficiary-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('vesting-schedules-list')).toBeInTheDocument();
    expect(screen.getByTestId('claim-history')).toBeInTheDocument();
  });

  it('should have correct CSS classes when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    const { container } = render(<BeneficiaryPage />);

    const mainContainer = container.querySelector('.container');
    expect(mainContainer).toHaveClass('container', 'mx-auto', 'px-4', 'py-8');

    const titleContainer = container.querySelector('.mb-8');
    expect(titleContainer).toBeInTheDocument();

    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-3xl', 'font-bold', 'mb-2');

    const description = container.querySelector('p');
    expect(description).toHaveClass('text-muted-foreground');

    const tabs = container.querySelector('[data-testid="tabs"]');
    expect(tabs).toHaveClass('space-y-6');
  });

  it('should have correct tab default value', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    const { container } = render(<BeneficiaryPage />);

    const tabs = container.querySelector('[data-testid="tabs"]');
    expect(tabs).toHaveAttribute('data-default-value', 'overview');
  });

  it('should handle undefined isConnected', () => {
    mockUseAccount.mockReturnValue({ isConnected: undefined } as any);

    render(<BeneficiaryPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('tabs')).not.toBeInTheDocument();
  });

  it('should handle null isConnected', () => {
    mockUseAccount.mockReturnValue({ isConnected: null } as any);

    render(<BeneficiaryPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('tabs')).not.toBeInTheDocument();
  });

  it('should render consistently across multiple renders', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    const { rerender } = render(<BeneficiaryPage />);

    expect(screen.getByText('Beneficiary Portal')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();

    rerender(<BeneficiaryPage />);

    expect(screen.getByText('Beneficiary Portal')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });

  it('should handle connection state changes', () => {
    const { rerender } = render(<BeneficiaryPage />);

    // Initially not connected
    mockUseAccount.mockReturnValue({ isConnected: false } as any);
    rerender(<BeneficiaryPage />);

    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('tabs')).not.toBeInTheDocument();

    // Then connected
    mockUseAccount.mockReturnValue({ isConnected: true } as any);
    rerender(<BeneficiaryPage />);

    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should maintain proper component hierarchy when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    const { container } = render(<BeneficiaryPage />);

    const navbar = container.querySelector('[data-testid="navbar"]');
    const mainContainer = container.querySelector('.container');
    const tabs = container.querySelector('[data-testid="tabs"]');
    const tabsList = container.querySelector('[data-testid="tabs-list"]');

    expect(navbar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(tabsList).toBeInTheDocument();

    // Check hierarchy
    expect(safeToContainElement(container.children[0], navbar)).toBe(true);
    expect(safeToContainElement(container.children[1], mainContainer)).toBe(true);
    expect(safeToContainElement(mainContainer, tabs)).toBe(true);
    expect(safeToContainElement(tabs, tabsList)).toBe(true);
  });

  it('should maintain proper component hierarchy when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false } as any);

    const { container } = render(<BeneficiaryPage />);

    const navbar = container.querySelector('[data-testid="navbar"]');
    const connectPrompt = container.querySelector('[data-testid="connect-wallet-prompt"]');

    expect(navbar).toBeInTheDocument();
    expect(connectPrompt).toBeInTheDocument();

    // Check hierarchy
    expect(safeToContainElement(container.children[0], navbar)).toBe(true);
    expect(safeToContainElement(container.children[1], connectPrompt)).toBe(true);
  });

  it('should render without errors', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    expect(() => render(<BeneficiaryPage />)).not.toThrow();
  });

  it('should handle missing useAccount hook gracefully', () => {
    mockUseAccount.mockReturnValue({} as any);

    render(<BeneficiaryPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
  });

  it('should have proper semantic structure', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    const { container } = render(<BeneficiaryPage />);

    const title = container.querySelector('h1');
    const description = container.querySelector('p');

    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(title?.textContent).toBe('Beneficiary Portal');
    expect(description?.textContent).toBe('View and manage your vested tokens');
  });

  it('should handle empty isConnected object', () => {
    mockUseAccount.mockReturnValue({} as any);

    render(<BeneficiaryPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('tabs')).not.toBeInTheDocument();
  });

  it('should have tab triggers with correct values', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    const { container } = render(<BeneficiaryPage />);

    const overviewTrigger = container.querySelector('[data-testid="tab-trigger-overview"]');
    const schedulesTrigger = container.querySelector('[data-testid="tab-trigger-schedules"]');
    const historyTrigger = container.querySelector('[data-testid="tab-trigger-history"]');

    expect(overviewTrigger).toHaveAttribute('data-value', 'overview');
    expect(schedulesTrigger).toHaveAttribute('data-value', 'schedules');
    expect(historyTrigger).toHaveAttribute('data-value', 'history');
  });

  it('should have tab content with correct values', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any);

    const { container } = render(<BeneficiaryPage />);

    const overviewContent = container.querySelector('[data-testid="tab-content-overview"]');
    const schedulesContent = container.querySelector('[data-testid="tab-content-schedules"]');
    const historyContent = container.querySelector('[data-testid="tab-content-history"]');

    expect(overviewContent).toHaveAttribute('data-value', 'overview');
    expect(schedulesContent).toHaveAttribute('data-value', 'schedules');
    expect(historyContent).toHaveAttribute('data-value', 'history');
  });
});
