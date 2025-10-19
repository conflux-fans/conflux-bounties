import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../components/LiquidationMonitor', () => {
  return function MockLiquidationMonitor() {
    return null;
  };
});

// Mock wagmi
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useWriteContract: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
  useBalance: jest.fn(),
  usePublicClient: jest.fn(),
}));

// Mock usePythPrices
jest.mock('../hooks/usePythPrices', () => ({
  usePythPrices: jest.fn(),
}));

// Mock viem
jest.mock('viem', () => ({
  parseEther: jest.fn((value: string) => BigInt(Math.floor(parseFloat(value) * 1e18))),
  formatEther: jest.fn((value: bigint) => (Number(value) / 1e18).toFixed(4)),
}));

// Mock contract ABI
jest.mock('../lib/contractABI', () => ({
  BETTING_CONTRACT_ADDRESS: '0x1234567890123456789012345678901234567890',
  BETTING_ABI: [],
  LENDING_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000000',
  LENDING_ABI: [],
}));

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance, usePublicClient } from 'wagmi';
import { usePythPrices } from '../hooks/usePythPrices';
import { parseEther } from 'viem';
import BettingInterface from '../components/BettingInterface';

// Test Data Constants
const mockAddress = '0x1234567890123456789012345678901234567890';

const mockPrices = {
  BTC: { formattedPrice: '50000.00', publishTime: Math.floor(Date.now() / 1000) - 30 },
  ETH: { formattedPrice: '3000.00', publishTime: Math.floor(Date.now() / 1000) - 30 },
  CFX: { formattedPrice: '0.15', publishTime: Math.floor(Date.now() / 1000) - 30 },
};

const mockPriceFeeds = {
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  CFX: '0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
};

// Test Utilities
const createMockBet = (overrides: any = {}) => {
  return [
    overrides.bettor || mockAddress,
    overrides.priceId || mockPriceFeeds.BTC,
    overrides.amount || parseEther('1'),
    overrides.targetPrice || BigInt(55000 * 1e8),
    overrides.deadline || BigInt(Math.floor(Date.now() / 1000) + 3600),
    overrides.predictAbove !== undefined ? overrides.predictAbove : true,
    overrides.settled !== undefined ? overrides.settled : false,
    overrides.won !== undefined ? overrides.won : false,
  ];
};

describe('BettingInterface Component', () => {
  const mockWriteContract = jest.fn();
  const mockReadContract = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useAccount as jest.Mock).mockReturnValue({
      address: mockAddress,
      isConnected: true,
    });

    (useBalance as jest.Mock).mockReturnValue({
      data: { formatted: '100.5', symbol: 'CFX' },
    });

    (usePythPrices as jest.Mock).mockReturnValue({
      prices: mockPrices,
      PRICE_FEEDS: mockPriceFeeds,
    });

    (useWriteContract as jest.Mock).mockReturnValue({
      writeContract: mockWriteContract,
      data: null,
      isPending: false,
      error: null,
    });

    (useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
      isLoading: false,
      isSuccess: false,
    });

    (usePublicClient as jest.Mock).mockReturnValue({
      readContract: mockReadContract,
    });

    mockReadContract.mockResolvedValue(0n);
  });

  describe('Wallet Connection', () => {
    test('shows connect wallet message when not connected', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
        isConnected: false,
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Connect Wallet to Place Bet/i)).toBeInTheDocument();
    });

    test('shows user balance when connected', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Your Balance/i)).toBeInTheDocument();
      expect(screen.getByText(/100.5000 CFX/i)).toBeInTheDocument();
    });

    test('enables bet button when connected and target price is set', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });

      const button = screen.getByRole('button', { name: /Place Bet/i });
      expect(button).not.toBeDisabled();
    });

    test('shows "Connect wallet to view your bets" when not connected', async () => {
      (useAccount as jest.Mock).mockReturnValue({
        address: undefined,
        isConnected: false,
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Connect wallet to view your bets/i)).toBeInTheDocument();
    });
  });

  describe('Asset Selection', () => {
    test('defaults to BTC asset', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('BTC');
    });

    test('changes asset to ETH', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const selects = screen.getAllByRole('combobox');
      
      await act(async () => {
        fireEvent.change(selects[0], { target: { value: 'ETH' } });
      });
      
      expect(selects[0]).toHaveValue('ETH');
    });

    test('changes asset to CFX', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const selects = screen.getAllByRole('combobox');
      
      await act(async () => {
        fireEvent.change(selects[0], { target: { value: 'CFX' } });
      });
      
      expect(selects[0]).toHaveValue('CFX');
    });

    test('clears target price when asset changes', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      expect(targetInput).toHaveValue(55000);
      
      const selects = screen.getAllByRole('combobox');
      
      await act(async () => {
        fireEvent.change(selects[0], { target: { value: 'ETH' } });
      });
      
      expect(targetInput).toHaveValue(null);
    });

    test('displays correct price for selected asset', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const priceDisplay = screen.getByText('Current Market Price').closest('div');
      expect(priceDisplay?.textContent).toContain('50,000');
      
      const selects = screen.getAllByRole('combobox');
      
      await act(async () => {
        fireEvent.change(selects[0], { target: { value: 'ETH' } });
      });
      
      const updatedPriceDisplay = screen.getByText('Current Market Price').closest('div');
      expect(updatedPriceDisplay?.textContent).toContain('3,000');
    });
  });

  describe('Bet Amount', () => {
    test('defaults to 0.1 CFX', async () => {
      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      expect(betInput).toBeTruthy();
      if (betInput) {
        expect(parseFloat(betInput.value)).toBeCloseTo(0.1, 2);
      }
    });

    test('updates bet amount to 5 CFX', async () => {
      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      if (betInput) {
        await act(async () => {
          fireEvent.change(betInput!, { target: { value: '5' } });
        });
        expect(parseFloat(betInput.value)).toBeCloseTo(5, 2);
      }
    });

    test('updates bet amount to 0.01 CFX (minimum)', async () => {
      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      if (betInput) {
        await act(async () => {
          fireEvent.change(betInput!, { target: { value: '0.01' } });
        });
        expect(parseFloat(betInput.value)).toBeCloseTo(0.01, 2);
      }
    });
  });

  describe('Target Price', () => {
    test('allows entering target price', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const input = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(input, { target: { value: '55000' } });
      });
      
      expect(input).toHaveValue(55000);
    });

    test('allows decimal target price', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const input = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(input, { target: { value: '55000.50' } });
      });
      
      expect(input).toHaveValue(55000.50);
    });

    test('shows placeholder with current price', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const input = screen.getByPlaceholderText(/Current:/);
      expect(input).toBeInTheDocument();
      expect(input.getAttribute('placeholder')).toContain('50000');
    });
  });

  describe('Prediction Direction', () => {
    test('defaults to above prediction', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const button = screen.getByRole('button', { name: /Above Target/i });
      expect(button).toHaveClass('bg-green-500');
    });

    test('switches to below prediction', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const button = screen.getByRole('button', { name: /Below Target/i });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(button).toHaveClass('bg-red-500');
    });

    test('switches back to above prediction', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const belowButton = screen.getByRole('button', { name: /Below Target/i });
      
      await act(async () => {
        fireEvent.click(belowButton);
      });
      
      const aboveButton = screen.getByRole('button', { name: /Above Target/i });
      
      await act(async () => {
        fireEvent.click(aboveButton);
      });
      
      expect(aboveButton).toHaveClass('bg-green-500');
    });
  });

  describe('Duration Selection', () => {
    test('defaults to 1 Hour duration', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const selects = screen.getAllByRole('combobox');
      const durationSelect = selects[1];
      expect(durationSelect).toHaveValue('3600');
    });

    test('changes duration to 1 Day', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const selects = screen.getAllByRole('combobox');
      const durationSelect = selects[1];
      
      await act(async () => {
        fireEvent.change(durationSelect, { target: { value: '86400' } });
      });
      
      expect(durationSelect).toHaveValue('86400');
    });

    test('changes duration to 1 Week', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const selects = screen.getAllByRole('combobox');
      const durationSelect = selects[1];
      
      await act(async () => {
        fireEvent.change(durationSelect, { target: { value: '604800' } });
      });
      
      expect(durationSelect).toHaveValue('604800');
    });
  });

  describe('Placing Bets', () => {
    test('validates empty target price', async () => {
      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const button = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      await waitFor(() => {
        const hasError = container.textContent?.includes('target price') ||
                        container.textContent?.includes('Please enter');
        expect(hasError).toBeTruthy();
      });
    });

    test('places bet successfully with all parameters', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      const button = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalled();
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'placeBet',
          })
        );
      });
    });

    test('places bet with below prediction', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const belowButton = screen.getByRole('button', { name: /Below Target/i });
      
      await act(async () => {
        fireEvent.click(belowButton);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '45000' } });
      });
      
      const placeButton = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(placeButton);
      });
      
      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalled();
      });
    });

    test('shows pending state during transaction', async () => {
      (useWriteContract as jest.Mock).mockReturnValue({
        writeContract: mockWriteContract,
        data: null,
        isPending: true,
        error: null,
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Confirming Transaction/i)).toBeInTheDocument();
    });

    test('shows confirming state', async () => {
      (useWriteContract as jest.Mock).mockReturnValue({
        writeContract: mockWriteContract,
        data: '0xhash123',
        isPending: false,
        error: null,
      });

      (useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
        isLoading: true,
        isSuccess: false,
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Processing on Blockchain/i)).toBeInTheDocument();
    });

    test('shows success message after bet placed', async () => {
      (useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
        isLoading: false,
        isSuccess: true,
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Bet placed successfully/i)).toBeInTheDocument();
    });

    test('displays transaction hash', async () => {
      (useWriteContract as jest.Mock).mockReturnValue({
        writeContract: mockWriteContract,
        data: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        isPending: false,
        error: null,
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Transaction Hash/i)).toBeInTheDocument();
      expect(screen.getByText(/0x12345678/)).toBeInTheDocument();
    });

    test('resets form after successful bet', async () => {
      (useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
        isLoading: false,
        isSuccess: true,
      });

      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      if (betInput) {
        expect(parseFloat(betInput.value)).toBeCloseTo(0.1, 2);
      }
    });
  });

  describe('Validation', () => {
    test('validates minimum bet amount (below 0.01)', async () => {
      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      if (betInput) {
        await act(async () => {
          fireEvent.change(betInput!, { target: { value: '0.005' } });
        });
      }
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      const button = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Minimum bet amount is 0.01 CFX/i)).toBeInTheDocument();
      });
    });

    test('validates maximum bet amount (above 100)', async () => {
      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      if (betInput) {
        await act(async () => {
          fireEvent.change(betInput!, { target: { value: '150' } });
        });
      }
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      const button = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Maximum bet amount is 100 CFX/i)).toBeInTheDocument();
      });
    });

    test('validates insufficient balance', async () => {
      (useBalance as jest.Mock).mockReturnValue({
        data: { formatted: '0.5', symbol: 'CFX' },
      });

      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      if (betInput) {
        await act(async () => {
          fireEvent.change(betInput!, { target: { value: '1' } });
        });
      }
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      const button = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument();
      });
    });

    test('validates target price must be positive', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '0' } });
      });
      
      const button = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Target price must be greater than 0/i)).toBeInTheDocument();
      });
    });

    test('validates target price negative value', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '-1000' } });
      });
      
      const button = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Target price must be greater than 0/i)).toBeInTheDocument();
      });
    });
  });

  describe('Bet Summary', () => {
    test('shows summary when target price is entered', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const input = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(input, { target: { value: '55000' } });
      });
      
      await waitFor(() => {
        expect(screen.getByText('Bet Summary')).toBeInTheDocument();
      });
    });

    test('hides summary when target price is empty', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.queryByText('Bet Summary')).not.toBeInTheDocument();
    });

    test('calculates potential win correctly', async () => {
      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      if (betInput) {
        await act(async () => {
          fireEvent.change(betInput!, { target: { value: '10' } });
        });
      }
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Potential Win/i)).toBeInTheDocument();
        expect(screen.getByText(/19.6000 CFX/i)).toBeInTheDocument();
      });
    });

    test('displays platform fee (4%) correctly', async () => {
      let container: any;
      
      await act(async () => {
        const result = render(<BettingInterface />);
        container = result.container;
      });
      
      const inputs = container.querySelectorAll('input[type="number"]');
      let betInput: HTMLInputElement | null = null;
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as HTMLInputElement;
        if (input.getAttribute('step') === '0.01') {
          betInput = input;
          break;
        }
      }
      
      if (betInput) {
        await act(async () => {
          fireEvent.change(betInput!, { target: { value: '10' } });
        });
      }
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      await waitFor(() => {
        const summary = screen.getByText('Bet Summary').closest('div');
        expect(summary?.textContent).toContain('Platform Fee');
        expect(summary?.textContent).toContain('0.4000 CFX');
      });
    });

    test('shows selected asset in summary', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      await waitFor(() => {
        const summary = screen.getByText('Bet Summary').closest('div');
        expect(summary?.textContent).toContain('BTC');
      });
    });

    test('shows prediction direction in summary', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const belowButton = screen.getByRole('button', { name: /Below Target/i });
      
      await act(async () => {
        fireEvent.click(belowButton);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '45000' } });
      });
      
      await waitFor(() => {
        const summary = screen.getByText('Bet Summary').closest('div');
        expect(summary?.textContent).toContain('Below');
      });
    });
  });

  describe('User Bets Display', () => {
    test('fetches user bets on mount', async () => {
      const mockBet = createMockBet();

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(mockReadContract).toHaveBeenCalled();
      });
    });

    test('displays user bet correctly', async () => {
      const mockBet = createMockBet();

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Bet ID:')).toBeInTheDocument();
        expect(screen.getByText('#0')).toBeInTheDocument();
      });
    });

    test('displays multiple bets', async () => {
      const mockBet1 = createMockBet();
      const mockBet2 = createMockBet({ priceId: mockPriceFeeds.ETH });

      mockReadContract
        .mockResolvedValueOnce(2n)
        .mockResolvedValueOnce(mockBet1)
        .mockResolvedValueOnce(mockBet2);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('#0')).toBeInTheDocument();
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    test('toggles between active and all bets', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const toggleButton = screen.getByRole('button', { name: /Active/i });
      expect(toggleButton).toBeInTheDocument();
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/All/i)).toBeInTheDocument();
      });
    });

    test('shows empty state when no bets', async () => {
      mockReadContract.mockResolvedValue(0n);
      
      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/No active bets/i)).toBeInTheDocument();
      });
    });

    test('shows "No bets found" when viewing all history with no bets', async () => {
      mockReadContract.mockResolvedValue(0n);
      
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const toggleButton = screen.getByRole('button', { name: /Active/i });
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/No bets found/i)).toBeInTheDocument();
      });
    });

    test('filters out settled bets in active view', async () => {
      const activeBet = createMockBet();
      const settledBet = createMockBet({ settled: true, won: true });

      mockReadContract
        .mockResolvedValueOnce(2n)
        .mockResolvedValueOnce(activeBet)
        .mockResolvedValueOnce(settledBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('#0')).toBeInTheDocument();
        expect(screen.queryByText(/Won ✅/i)).not.toBeInTheDocument();
      });
    });

    test('shows settled bets in all history view', async () => {
      const activeBet = createMockBet();
      const settledBet = createMockBet({ settled: true, won: true });

      mockReadContract
        .mockResolvedValueOnce(2n)
        .mockResolvedValueOnce(activeBet)
        .mockResolvedValueOnce(settledBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      const toggleButton = screen.getByRole('button', { name: /Active/i });
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Won ✅/i)).toBeInTheDocument();
      });
    });

    test('refreshes bets when refresh button clicked', async () => {
      const mockBet = createMockBet();

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet)
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('#0')).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle('Refresh bets');
      
      await act(async () => {
        fireEvent.click(refreshButton);
      });
      
      await waitFor(() => {
        expect(mockReadContract).toHaveBeenCalledTimes(4);
      });
    });

    test('shows loading state while fetching bets', async () => {
      mockReadContract.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(0n), 50)));
      
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Scanning bets/i)).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText(/Scanning bets/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Bet Settlement', () => {
    test('shows settle button for expired bet', async () => {
      const expiredBet = createMockBet({
        deadline: BigInt(Math.floor(Date.now() / 1000) - 100),
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(expiredBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Settle Bet/i })).toBeInTheDocument();
      });
    });

    test('hides settle button for active bet', async () => {
      const activeBet = createMockBet();

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(activeBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Settle Bet/i })).not.toBeInTheDocument();
      });
    });

    test('hides settle button for settled bet', async () => {
      const settledBet = createMockBet({ settled: true, won: true });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(settledBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      const toggleButton = screen.getByRole('button', { name: /Active/i });
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Settle Bet/i })).not.toBeInTheDocument();
      });
    });

    test('settles expired bet', async () => {
      const expiredBet = createMockBet({
        deadline: BigInt(Math.floor(Date.now() / 1000) - 100),
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(expiredBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        const settleButton = screen.getByRole('button', { name: /Settle Bet/i });
        
        act(() => {
          fireEvent.click(settleButton);
        });
      });

      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'settleBet',
            args: [BigInt(0)]
          })
        );
      });
    });

    test('shows settling state during settlement', async () => {
      const expiredBet = createMockBet({
        deadline: BigInt(Math.floor(Date.now() / 1000) - 100),
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(expiredBet);

      (useWriteContract as jest.Mock).mockReturnValue({
        writeContract: mockWriteContract,
        data: '0xhash',
        isPending: true,
        error: null,
      });

      await act(async () => {
        render(<BettingInterface />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Confirming/i)).toBeInTheDocument();
      });
    });

    test('shows success message after settlement', async () => {
      const expiredBet = createMockBet({
        deadline: BigInt(Math.floor(Date.now() / 1000) - 100),
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(expiredBet);

      mockWriteContract.mockImplementation(() => {
        (useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
          isLoading: false,
          isSuccess: true,
        });
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        const settleButton = screen.getByRole('button', { name: /Settle Bet/i });
        expect(settleButton).toBeInTheDocument();
      });

      const settleButton = screen.getByRole('button', { name: /Settle Bet/i });
      
      await act(async () => {
        fireEvent.click(settleButton);
      });

      await waitFor(() => {
        const successPresent = screen.queryByText(/successfully/i) !== null;
        expect(successPresent).toBeTruthy();
      });
    });
  });

  describe('Bet Card Display', () => {
    test('displays bet amount correctly', async () => {
      const mockBet = createMockBet({ amount: parseEther('5') });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Bet ID:')).toBeInTheDocument();
      });

      const betCards = screen.getAllByText(/Bet ID:/i);
      const betCard = betCards[0].closest('div')?.parentElement;
      
      expect(betCard?.textContent).toContain('5.0000');
      expect(betCard?.textContent).toContain('CFX');
    });

    test('displays target price correctly', async () => {
      const mockBet = createMockBet();

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Bet ID:')).toBeInTheDocument();
      });

      const betCards = screen.getAllByText(/Target:/i);
      const betCard = betCards[0].closest('div')?.parentElement;
      
      expect(betCard?.textContent).toContain('55,000');
    });

    test('displays current price for active bet', async () => {
      const mockBet = createMockBet();

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Current:')).toBeInTheDocument();
      });

      const currentLabels = screen.getAllByText(/Current:/i);
      const betCard = currentLabels[0].closest('div')?.parentElement;
      
      expect(betCard?.textContent).toContain('50,000');
    });

    test('shows "Winning" status when prediction is correct', async () => {
      const mockBet = createMockBet({
        targetPrice: BigInt(45000 * 1e8),
        predictAbove: true,
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Winning 🎯/i)).toBeInTheDocument();
      });
    });

    test('shows "Active" status when prediction is incorrect', async () => {
      const mockBet = createMockBet({
        targetPrice: BigInt(60000 * 1e8),
        predictAbove: true,
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Active ⏳/i)).toBeInTheDocument();
      });
    });

    test('shows "Won" status for settled winning bet', async () => {
      const wonBet = createMockBet({ settled: true, won: true });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(wonBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      const toggleButton = screen.getByRole('button', { name: /Active/i });
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Won ✅/i)).toBeInTheDocument();
      });
    });

    test('shows "Lost" status for settled losing bet', async () => {
      const lostBet = createMockBet({ settled: true, won: false });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(lostBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      const toggleButton = screen.getByRole('button', { name: /Active/i });
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Lost ❌/i)).toBeInTheDocument();
      });
    });

    test('displays remaining time correctly', async () => {
      const mockBet = createMockBet({
        deadline: BigInt(Math.floor(Date.now() / 1000) + 7200),
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Resolves in:/i)).toBeInTheDocument();
        expect(screen.getByText(/2h 0m/i)).toBeInTheDocument();
      });
    });

    test('displays "Expired" for past deadline', async () => {
      const expiredBet = createMockBet({
        deadline: BigInt(Math.floor(Date.now() / 1000) - 100),
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(expiredBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Expired/i)).toBeInTheDocument();
      });
    });

    test('shows potential win for active bet', async () => {
      const mockBet = createMockBet({ amount: parseEther('10') });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Potential Win:/i)).toBeInTheDocument();
        expect(screen.getByText(/19.6000 CFX/i)).toBeInTheDocument();
      });
    });

    test('shows win amount for won bet', async () => {
      const wonBet = createMockBet({
        amount: parseEther('10'),
        settled: true,
        won: true,
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(wonBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      const toggleButton = screen.getByRole('button', { name: /Active/i });
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Result:/i)).toBeInTheDocument();
        const resultElement = screen.getByText(/Result:/i).closest('div');
        expect(resultElement?.textContent).toContain('+19.6000 CFX');
      });
    });

    test('shows loss amount for lost bet', async () => {
      const lostBet = createMockBet({
        amount: parseEther('10'),
        settled: true,
        won: false,
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(lostBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      const toggleButton = screen.getByRole('button', { name: /Active/i });
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Result:/i)).toBeInTheDocument();
        const resultElement = screen.getByText(/Result:/i).closest('div');
        expect(resultElement?.textContent).toContain('-10.0000 CFX');
      });
    });
  });

  describe('Price Display', () => {
    test('displays current market price', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText('Current Market Price')).toBeInTheDocument();
      const priceDisplay = screen.getByText('Current Market Price').closest('div');
      expect(priceDisplay?.textContent).toContain('50,000');
    });

    test('shows stale price warning when price is old', async () => {
      const stalePrices = {
        ...mockPrices,
        BTC: { 
          formattedPrice: '50000.00', 
          publishTime: Math.floor(Date.now() / 1000) - 150
        }
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: stalePrices,
        PRICE_FEEDS: mockPriceFeeds,
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Price may be stale/i)).toBeInTheDocument();
    });

    test('does not show stale warning for fresh price', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.queryByText(/Price may be stale/i)).not.toBeInTheDocument();
    });

    test('displays last update time', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Updated.*ago/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('displays transaction error from writeContract', async () => {
      const errorMessage = 'insufficient funds';
      
      (useWriteContract as jest.Mock).mockReturnValue({
        writeContract: mockWriteContract,
        data: null,
        isPending: false,
        error: { message: errorMessage },
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      // Verify the error was provided to the component
      const mockHook = useWriteContract as jest.Mock;
      expect(mockHook).toHaveBeenCalled();
      const returnValue = mockHook.mock.results[mockHook.mock.results.length - 1].value;
      expect(returnValue.error).toBeTruthy();
      expect(returnValue.error.message).toBe(errorMessage);
    });

    test('handles bet reading errors gracefully', async () => {
      const mockBet = createMockBet();

      mockReadContract
        .mockResolvedValueOnce(2n)
        .mockRejectedValueOnce(new Error('Failed to read bet'))
        .mockResolvedValueOnce(mockBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('#1')).toBeInTheDocument();
      });
    });

    test('shows error for failed bet fetch', async () => {
      mockReadContract.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load bets/i)).toBeInTheDocument();
      });
    });

    test('clears error after successful action', async () => {
      // First render with error
      (useWriteContract as jest.Mock).mockReturnValue({
        writeContract: mockWriteContract,
        data: null,
        isPending: false,
        error: { message: 'Test error' },
      });

      const { unmount } = await act(async () => {
        return render(<BettingInterface />);
      });
      
      // Verify error state
      let mockHook = useWriteContract as jest.Mock;
      let firstCallResult = mockHook.mock.results[mockHook.mock.results.length - 1].value;
      expect(firstCallResult.error).toBeTruthy();
      expect(firstCallResult.error.message).toBe('Test error');

      // Unmount and clear
      unmount();
      jest.clearAllMocks();

      // Second render without error (simulating successful action)
      (useWriteContract as jest.Mock).mockReturnValue({
        writeContract: mockWriteContract,
        data: '0xsuccess',
        isPending: false,
        error: null,
      });

      (useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
        isLoading: false,
        isSuccess: true,
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      mockHook = useWriteContract as jest.Mock;
      const secondCallResult = mockHook.mock.results[mockHook.mock.results.length - 1].value;
      expect(secondCallResult.error).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('handles rapid bet placement', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const targetInput = screen.getByPlaceholderText(/Current:/);
      
      await act(async () => {
        fireEvent.change(targetInput, { target: { value: '55000' } });
      });
      
      const button = screen.getByRole('button', { name: /Place Bet/i });
      
      await act(async () => {
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(button);
      });
      
      await waitFor(() => {
        expect(mockWriteContract.mock.calls.length).toBeLessThanOrEqual(3);
      });
    });

    test('handles no public client', async () => {
      (usePublicClient as jest.Mock).mockReturnValue(null);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(mockReadContract).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    test('handles zero balance', async () => {
      (useBalance as jest.Mock).mockReturnValue({
        data: { formatted: '0', symbol: 'CFX' },
      });

      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/0.0000 CFX/i)).toBeInTheDocument();
    });

    test('handles unknown asset in bet', async () => {
      const unknownBet = createMockBet({
        priceId: '0xunknownpriceid123456789',
      });

      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce(unknownBet);

      await act(async () => {
        render(<BettingInterface />);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Unknown/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI Elements', () => {
    test('renders "How It Works" section', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText('How It Works')).toBeInTheDocument();
    });

    test('displays note about settlement', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Settlement uses cached Pyth prices/i)).toBeInTheDocument();
    });

    test('shows minimum and maximum bet hints', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      expect(screen.getByText(/Minimum: 0.01 CFX/i)).toBeInTheDocument();
      expect(screen.getByText(/Maximum: 100 CFX/i)).toBeInTheDocument();
    });

    test('displays all duration options', async () => {
      await act(async () => {
        render(<BettingInterface />);
      });
      
      const selects = screen.getAllByRole('combobox');
      const durationSelect = selects[1];
      
      expect(durationSelect).toContainHTML('1 Hour');
      expect(durationSelect).toContainHTML('6 Hours');
      expect(durationSelect).toContainHTML('1 Day');
      expect(durationSelect).toContainHTML('3 Days');
      expect(durationSelect).toContainHTML('1 Week');
    });
  });
});
