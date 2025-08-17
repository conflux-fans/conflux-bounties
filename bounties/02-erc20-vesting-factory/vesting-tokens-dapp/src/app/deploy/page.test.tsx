import React from 'react';
import { render, screen } from '@testing-library/react';
import DeployPage from './page';

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

jest.mock('@/components/deploy/deployment-wizard', () => ({
  DeploymentWizard: () => <div data-testid="deployment-wizard">Deployment Wizard</div>
}));

const mockUseAccount = require('wagmi').useAccount;

describe('DeployPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render connect wallet prompt when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false });

    render(<DeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('deployment-wizard')).not.toBeInTheDocument();
  });

  it('should render deployment content when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    render(<DeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('deployment-wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should render deploy page title and description when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    render(<DeployPage />);

    expect(screen.getByText('Deploy Token with Vesting')).toBeInTheDocument();
    expect(screen.getByText('Create your ERC20 token and configure vesting schedules in a single transaction')).toBeInTheDocument();
  });

  it('should have correct CSS classes when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<DeployPage />);

    const mainContainer = container.querySelector('.container');
    expect(mainContainer).toHaveClass('container', 'mx-auto', 'px-4', 'py-8');

    const maxWidthContainer = container.querySelector('.max-w-4xl');
    expect(maxWidthContainer).toHaveClass('max-w-4xl', 'mx-auto');

    const titleContainer = container.querySelector('.mb-8');
    expect(titleContainer).toBeInTheDocument();

    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-3xl', 'font-bold', 'mb-2');

    const description = container.querySelector('p');
    expect(description).toHaveClass('text-muted-foreground');
  });

  it('should handle undefined isConnected', () => {
    mockUseAccount.mockReturnValue({ isConnected: undefined });

    render(<DeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('deployment-wizard')).not.toBeInTheDocument();
  });

  it('should handle null isConnected', () => {
    mockUseAccount.mockReturnValue({ isConnected: null });

    render(<DeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('deployment-wizard')).not.toBeInTheDocument();
  });

  it('should render consistently across multiple renders', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { rerender } = render(<DeployPage />);

    expect(screen.getByText('Deploy Token with Vesting')).toBeInTheDocument();
    expect(screen.getByTestId('deployment-wizard')).toBeInTheDocument();

    rerender(<DeployPage />);

    expect(screen.getByText('Deploy Token with Vesting')).toBeInTheDocument();
    expect(screen.getByTestId('deployment-wizard')).toBeInTheDocument();
  });

  it('should handle connection state changes', () => {
    const { rerender } = render(<DeployPage />);

    // Initially not connected
    mockUseAccount.mockReturnValue({ isConnected: false });
    rerender(<DeployPage />);

    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('deployment-wizard')).not.toBeInTheDocument();

    // Then connected
    mockUseAccount.mockReturnValue({ isConnected: true });
    rerender(<DeployPage />);

    expect(screen.getByTestId('deployment-wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-wallet-prompt')).not.toBeInTheDocument();
  });

  it('should maintain proper component hierarchy when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<DeployPage />);

    const navbar = container.querySelector('[data-testid="navbar"]');
    const mainContainer = container.querySelector('.container');
    const maxWidthContainer = container.querySelector('.max-w-4xl');
    const deploymentWizard = container.querySelector('[data-testid="deployment-wizard"]');

    expect(navbar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();
    expect(maxWidthContainer).toBeInTheDocument();
    expect(deploymentWizard).toBeInTheDocument();

    // Check hierarchy
    expect(container.children[0]).toContainElement(navbar);
    expect(container.children[1]).toContainElement(mainContainer);
    expect(mainContainer).toContainElement(maxWidthContainer);
    expect(maxWidthContainer).toContainElement(deploymentWizard);
  });

  it('should maintain proper component hierarchy when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false });

    const { container } = render(<DeployPage />);

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

    expect(() => render(<DeployPage />)).not.toThrow();
  });

  it('should handle missing useAccount hook gracefully', () => {
    mockUseAccount.mockReturnValue({});

    render(<DeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
  });

  it('should have proper semantic structure', () => {
    mockUseAccount.mockReturnValue({ isConnected: true });

    const { container } = render(<DeployPage />);

    const title = container.querySelector('h1');
    const description = container.querySelector('p');

    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(title?.textContent).toBe('Deploy Token with Vesting');
    expect(description?.textContent).toBe('Create your ERC20 token and configure vesting schedules in a single transaction');
  });

  it('should handle empty isConnected object', () => {
    mockUseAccount.mockReturnValue({});

    render(<DeployPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('deployment-wizard')).not.toBeInTheDocument();
  });
});
