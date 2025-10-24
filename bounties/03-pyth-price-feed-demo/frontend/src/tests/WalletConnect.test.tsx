import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

// Mock LiquidationMonitor to prevent act warnings
jest.mock('../components/LiquidationMonitor', () => {
  return function MockLiquidationMonitor() {
    return null;
  };
});

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useConnect: jest.fn(),
  useDisconnect: jest.fn(),
  useChainId: jest.fn(),
  useSwitchChain: jest.fn(),
}));

import WalletConnect from '../components/WalletConnect';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';

const mockAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

describe('WalletConnect Component', () => {
  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();
  const mockSwitchChain = jest.fn();
  
  const mockConnectors = [
    {
      id: 'injected',
      name: 'MetaMask',
      ready: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (useAccount as jest.Mock).mockReturnValue({
      address: undefined,
      isConnected: false,
    });

    (useConnect as jest.Mock).mockReturnValue({
      connect: mockConnect,
      connectors: mockConnectors,
    });

    (useDisconnect as jest.Mock).mockReturnValue({
      disconnect: mockDisconnect,
    });

    (useChainId as jest.Mock).mockReturnValue(1);

    (useSwitchChain as jest.Mock).mockReturnValue({
      switchChain: mockSwitchChain,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Disconnected State', () => {
    test('renders connect wallet button when disconnected', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
      });
    });

    test('connect button has gradient styling', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        const connectButton = screen.getByRole('button', { name: /connect wallet/i });
        expect(connectButton).toHaveClass('bg-gradient-to-r', 'from-blue-500', 'to-indigo-600');
      });
    });

    test('calls connect when button is clicked', async () => {
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = await screen.findByRole('button', { name: /connect wallet/i });
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith({
          connector: mockConnectors[0],
        });
      });
    });

    test('uses first connector for connection', async () => {
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = await screen.findByRole('button', { name: /connect wallet/i });
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith({
          connector: expect.objectContaining({
            id: 'injected',
          }),
        });
      });
    });

    test('connect button has hover effects', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        const connectButton = screen.getByRole('button', { name: /connect wallet/i });
        expect(connectButton).toHaveClass('hover:from-blue-600', 'hover:to-indigo-700');
      });
    });

    test('connect button has shadow styling', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        const connectButton = screen.getByRole('button', { name: /connect wallet/i });
        expect(connectButton).toHaveClass('shadow-md', 'hover:shadow-lg');
      });
    });
  });

  describe('Connected State', () => {
    beforeEach(() => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);
    });

    test('renders connected UI when wallet is connected', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
      });
    });

    test('displays formatted address', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByText('0x742d...f44e')).toBeInTheDocument();
      });
    });

    test('shows green pulse indicator', async () => {
      const { container } = render(<WalletConnect />);
      
      await waitFor(() => {
        const indicator = container.querySelector('.bg-green-500.animate-pulse');
        expect(indicator).toBeInTheDocument();
      });
    });

    test('calls disconnect when disconnect button is clicked', async () => {
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const disconnectButton = await screen.findByRole('button', { name: /disconnect/i });
      await user.click(disconnectButton);
      
      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
      });
    });

    test('disconnect button has red styling', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
        expect(disconnectButton).toHaveClass('bg-red-500', 'hover:bg-red-600');
      });
    });

    test('address container has gray background', async () => {
      const { container } = render(<WalletConnect />);
      
      await waitFor(() => {
        const addressContainer = container.querySelector('.bg-gray-100');
        expect(addressContainer).toBeInTheDocument();
        expect(addressContainer).toHaveTextContent('0x742d...f44e');
      });
    });
  });

  describe('Chain Switching', () => {
    test('does not show switch chain button when on Conflux eSpace', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /switch to conflux espace/i })).not.toBeInTheDocument();
      });
    });

    test('shows switch chain button when on wrong network', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to conflux espace/i })).toBeInTheDocument();
      });
    });

    test('calls switchChain with correct chainId', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const switchButton = await screen.findByRole('button', { name: /switch to conflux espace/i });
      await user.click(switchButton);
      
      await waitFor(() => {
        expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: 1030 });
      });
    });

    test('switch chain button has yellow styling', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const switchButton = screen.getByRole('button', { name: /switch to conflux espace/i });
        expect(switchButton).toHaveClass('bg-yellow-500', 'hover:bg-yellow-600');
      });
    });

    test('handles undefined switchChain gracefully', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);
      (useSwitchChain as jest.Mock).mockReturnValue({
        switchChain: undefined,
      });

      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const switchButton = await screen.findByRole('button', { name: /switch to conflux espace/i });
      await user.click(switchButton);
      
      await waitFor(() => {
        expect(mockSwitchChain).not.toHaveBeenCalled();
      });
    });

    test('shows switch button for various wrong chain IDs', async () => {
      const wrongChainIds = [1, 5, 56, 137, 8453];
      
      for (const chainId of wrongChainIds) {
        (useAccount as jest.Mock).mockReturnValue({
          address: mockAddress,
          isConnected: true,
        });

        (useChainId as jest.Mock).mockReturnValue(chainId);

        const { unmount } = render(<WalletConnect />);
        
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /switch to conflux espace/i })).toBeInTheDocument();
        });
        
        unmount();
      }
    });
  });

  describe('Address Formatting', () => {
    test('formats standard Ethereum address correctly', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByText('0x742d...f44e')).toBeInTheDocument();
      });
    });

    test('formats lowercase address correctly', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
      });
    });

    test('formats uppercase address correctly', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByText('0xABCD...EF12')).toBeInTheDocument();
      });
    });

    test('shows first 6 characters and last 4 characters', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: '0x9876543210987654321098765432109876543210',
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const addressText = screen.getByText('0x9876...3210');
        expect(addressText).toBeInTheDocument();
        expect(addressText.textContent).toMatch(/^0x[a-fA-F0-9]{4}...[a-fA-F0-9]{4}$/);
      });
    });
  });

  describe('Component Layout', () => {
    test('connected state shows elements in flex layout', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      const { container } = render(<WalletConnect />);
      
      await waitFor(() => {
        const flexContainer = container.querySelector('.flex.items-center.space-x-4');
        expect(flexContainer).toBeInTheDocument();
      });
    });

    test('address and disconnect button are in same container', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
        const address = screen.getByText('0x742d...f44e');
        expect(disconnectButton.parentElement).toContainElement(address);
      });
    });

    test('switch chain button appears before address when on wrong network', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      const { container } = render(<WalletConnect />);
      
      await waitFor(() => {
        const switchButton = screen.getByRole('button', { name: /switch to conflux espace/i });
        const address = screen.getByText('0x742d...f44e');
        
        const parent = container.querySelector('.flex.items-center.space-x-4');
        const children = Array.from(parent?.children || []);
        
        const switchIndex = children.indexOf(switchButton.parentElement!);
        const addressIndex = children.findIndex(el => el.contains(address));
        
        expect(switchIndex).toBeLessThan(addressIndex);
      });
    });
  });

  describe('Button States', () => {
    test('all buttons are not disabled by default', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        const connectButton = screen.getByRole('button', { name: /connect wallet/i });
        expect(connectButton).not.toBeDisabled();
      });
    });

    test('disconnect button is not disabled', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
        expect(disconnectButton).not.toBeDisabled();
      });
    });

    test('switch chain button is not disabled', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const switchButton = screen.getByRole('button', { name: /switch to conflux espace/i });
        expect(switchButton).not.toBeDisabled();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles missing address gracefully', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
        isConnected: true,
      });

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
      });
    });

    test('handles empty address', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: '',
        isConnected: true,
      });

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
      });
    });

    test('handles null address', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: null,
        isConnected: true,
      });

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
      });
    });

    test('handles empty connectors array', async () => {
      (useConnect as jest.Mock).mockReturnValue({
        connect: mockConnect,
        connectors: [],
      });

      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = await screen.findByRole('button', { name: /connect wallet/i });
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith({
          connector: undefined,
        });
      });
    });

    test('handles very short address', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: '0x123',
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const addressText = screen.getByText(/0x123/);
        expect(addressText).toBeInTheDocument();
      });
    });

    test('handles chainId 0', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(0);

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to conflux espace/i })).toBeInTheDocument();
      });
    });

    test('handles undefined chainId', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(undefined);

      render(<WalletConnect />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to conflux espace/i })).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Clicks', () => {
    test('handles multiple connect clicks', async () => {
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = await screen.findByRole('button', { name: /connect wallet/i });
      
      await user.click(connectButton);
      await user.click(connectButton);
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledTimes(3);
      });
    });

    test('handles multiple disconnect clicks', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const disconnectButton = await screen.findByRole('button', { name: /disconnect/i });
      
      await user.click(disconnectButton);
      await user.click(disconnectButton);
      
      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalledTimes(2);
      });
    });

    test('handles multiple switch chain clicks', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const switchButton = await screen.findByRole('button', { name: /switch to conflux espace/i });
      
      await user.click(switchButton);
      await user.click(switchButton);
      
      await waitFor(() => {
        expect(mockSwitchChain).toHaveBeenCalledTimes(2);
        expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: 1030 });
      });
    });
  });

  describe('Visual Indicators', () => {
    test('shows pulse animation on connection indicator', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      const { container } = render(<WalletConnect />);
      
      await waitFor(() => {
        const pulseIndicator = container.querySelector('.animate-pulse');
        expect(pulseIndicator).toBeInTheDocument();
        expect(pulseIndicator).toHaveClass('bg-green-500');
      });
    });

    test('indicator has correct size', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1030);

      const { container } = render(<WalletConnect />);
      
      await waitFor(() => {
        const indicator = container.querySelector('.w-2.h-2');
        expect(indicator).toBeInTheDocument();
        expect(indicator).toHaveClass('rounded-full');
      });
    });
  });

  describe('Accessibility', () => {
    test('buttons have readable text', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        const connectButton = screen.getByRole('button', { name: /connect wallet/i });
        expect(connectButton).toHaveAccessibleName();
      });
    });

    test('connected state buttons have readable text', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const switchButton = screen.getByRole('button', { name: /switch to conflux espace/i });
        const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
        
        expect(switchButton).toHaveAccessibleName();
        expect(disconnectButton).toHaveAccessibleName();
      });
    });

    test('all buttons are keyboard accessible', async () => {
      render(<WalletConnect />);
      
      await waitFor(() => {
        const connectButton = screen.getByRole('button', { name: /connect wallet/i });
        connectButton.focus();
        expect(connectButton).toHaveFocus();
      });
    });
  });

  describe('Styling Consistency', () => {
    test('all buttons have consistent padding', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toHaveClass('px-4', 'py-2');
        });
      });
    });

    test('all buttons have rounded corners', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toHaveClass('rounded-lg');
        });
      });
    });

    test('all buttons have transition effects', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });

      (useChainId as jest.Mock).mockReturnValue(1);

      render(<WalletConnect />);
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button.className).toMatch(/transition/);
        });
      });
    });
  });
});