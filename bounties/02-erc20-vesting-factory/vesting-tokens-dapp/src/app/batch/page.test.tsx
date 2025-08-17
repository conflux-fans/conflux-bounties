import React from 'react';
import { render, screen } from '@testing-library/react';
import BatchDeployPage from './page';

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

jest.mock('@/components/batch/batch-deployment-wizard', () => ({
  BatchDeploymentWizard: () => <div data-testid="batch-deployment-wizard">Batch Deployment Wizard</div>
}));

const mockUseAccount = require('wagmi').useAccount;

describe('BatchDeployPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render connect wallet prompt when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false });

    render(<BatchDeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('batch-deployment-wizard')).not.toBeInTheDocument();
  });

  it('should render batch deployment content when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    render(<BatchDeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('batch-deployment-wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should render batch page title and description when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    render(<BatchDeployPage />);

    expect(screen.getByText('Batch Token Deployment')).toBeInTheDocument();
    expect(screen.getByText('Deploy multiple tokens with vesting schedules in a single transaction. Import from CSV or configure manually.')).toBeInTheDocument();
  });

  it('should have correct CSS classes when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<BatchDeployPage />);

    const mainContainer = container.querySelector('.container');
    expect(mainContainer).toHaveClass('container', 'mx-auto', 'px-4', 'py-8');

    const maxWidthContainer = container.querySelector('.max-w-6xl');
    expect(maxWidthContainer).toHaveClass('max-w-6xl', 'mx-auto');

    const titleContainer = container.querySelector('.mb-8');
    expect(titleContainer).toBeInTheDocument();

    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-3xl', 'font-bold', 'mb-2');

    const description = container.querySelector('p');
    expect(description).toHaveClass('text-muted-foreground');
  });

  it('should handle undefined isConnected', () => {
    mockUseAccount.mockReturnValue({ isConnected: undefined });

    render(<BatchDeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('batch-deployment-wizard')).not.toBeInTheDocument();
  });

  it('should handle null isConnected', () => {
    mockUseAccount.mockReturnValue({ isConnected: null });

    render(<BatchDeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('batch-deployment-wizard')).not.toBeInTheDocument();
  });

  it('should render consistently across multiple renders', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { rerender } = render(<BatchDeployPage />);

    expect(screen.getByText('Batch Token Deployment')).toBeInTheDocument();
    expect(screen.getByTestId('batch-deployment-wizard')).toBeInTheDocument();

    rerender(<BatchDeployPage />);

    expect(screen.getByText('Batch Token Deployment')).toBeInTheDocument();
    expect(screen.getByTestId('batch-deployment-wizard')).toBeInTheDocument();
  });

  it('should handle connection state changes', () => {
    const { rerender } = render(<BatchDeployPage />);

    // Initially not connected
    mockUseAccount.mockReturnValue({ isConnected: false });
    rerender(<BatchDeployPage />);

    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('batch-deployment-wizard')).not.toBeInTheDocument();

    // Then connected
    mockUseAccount.mockReturnValue({ isConnected: true });
    rerender(<BatchDeployPage />);

    expect(screen.getByTestId('batch-deployment-wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should maintain proper component hierarchy when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<BatchDeployPage />);

    const navbar = container.querySelector('[data-testid="navbar"]');
    const mainContainer = container.querySelector('.container');
    const maxWidthContainer = container.querySelector('.max-w-6xl');
    const batchWizard = container.querySelector('[data-testid="batch-deployment-wizard"]');

    expect(navbar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();
    expect(maxWidthContainer).toBeInTheDocument();
    expect(batchWizard).toBeInTheDocument();

    // Check hierarchy
    expect(container.children[0]).toContainElement(navbar);
    expect(container.children[1]).toContainElement(mainContainer);
    expect(mainContainer).toContainElement(maxWidthContainer);
    expect(maxWidthContainer).toContainElement(batchWizard);
  });

  it('should maintain proper component hierarchy when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false });

    const { container } = render(<BatchDeployPage />);

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

    expect(() => render(<BatchDeployPage />)).not.toThrow();
  });

  it('should handle missing useAccount hook gracefully', () => {
    mockUseAccount.mockReturnValue({});

    render(<BatchDeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
  });

  it('should have proper semantic structure', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<BatchDeployPage />);

    const title = container.querySelector('h1');
    const description = container.querySelector('p');

    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(title?.textContent).toBe('Batch Token Deployment');
    expect(description?.textContent).toBe('Deploy multiple tokens with vesting schedules in a single transaction. Import from CSV or configure manually.');
  });

  it('should handle empty isConnected object', () => {
    mockUseAccount.mockReturnValue({});

    render(<BatchDeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('batch-deployment-wizard')).not.toBeInTheDocument();
  });

  it('should have different max width than deploy page', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<BatchDeployPage />);

    const maxWidthContainer = container.querySelector('.max-w-6xl');
    expect(maxWidthContainer).toHaveClass('max-w-6xl');
    expect(maxWidthContainer).not.toHaveClass('max-w-4xl');
  });
});
