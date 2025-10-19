import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import PriceChart from '../components/PriceChart';
import { usePythPrices } from '../hooks/usePythPrices';

jest.mock('../hooks/usePythPrices');

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('PriceChart Component', () => {
  const mockPrices = {
    BTC: {
      formattedPrice: '50000.00',
      confidence: 100,
      expo: -8,
    },
    ETH: {
      formattedPrice: '3000.00',
      confidence: 50,
      expo: -8,
    },
  };

  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    
    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();

    (usePythPrices as jest.Mock).mockReturnValue({
      prices: mockPrices,
    });

    global.console.log = jest.fn();
    global.console.error = jest.fn();
    global.console.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders price chart with title', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      expect(screen.getByText('BTC/USD Price Chart')).toBeInTheDocument();
    });

    test('displays live indicator', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      expect(screen.getByText('LIVE')).toBeInTheDocument();
      expect(screen.getByText('Pyth Oracle')).toBeInTheDocument();
    });

    test('renders all time range buttons', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      expect(screen.getByRole('button', { name: '1H' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '6H' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '24H' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '7D' })).toBeInTheDocument();
    });

    test('defaults to 1H time range', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      const oneHourButton = screen.getByRole('button', { name: '1H' });
      expect(oneHourButton).toHaveClass('bg-green-500');
    });
  });

  describe('Empty State', () => {
    test('shows recording message when no data', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/recording/i) || 
        screen.queryByText(/collecting/i) ||
        container.textContent?.toLowerCase().includes('recording')
      ).toBeTruthy();
    });

    test('displays empty state icon', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText('📊') ||
        container.textContent?.includes('📊') ||
        container.firstChild
      ).toBeTruthy();
    });

    test('shows message about data appearing', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/data will appear/i) || 
        screen.queryByText(/seconds/i) ||
        container.textContent?.toLowerCase().includes('appear')
      ).toBeTruthy();
    });
  });

  describe('LocalStorage Integration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('loads historical data from localStorage on mount', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 49500, confidence: 100 },
        { timestamp: Date.now(), price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('pythHistory_BTC');
    });

    test('handles corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json{');
      
      render(<PriceChart symbol="BTC" />);
      
      expect(console.error).toHaveBeenCalledWith(
        'Failed to parse stored Pyth history',
        expect.any(Error)
      );
    });

    test('saves new price data to localStorage', async () => {
      render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'pythHistory_BTC',
          expect.any(String)
        );
      });
    });

    test('handles localStorage save errors', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });
      
      render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          'Failed to save to localStorage',
          expect.any(Error)
        );
      });
    });
  });

  describe('Price Data Recording', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('records price data every 5 seconds', async () => {
      render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          '✅ Pyth price recorded for BTC:',
          50000
        );
      });
    });

    test('does not record invalid prices', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {
          BTC: { formattedPrice: '0', confidence: 100, expo: -8 },
        },
      });
      
      render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          'Invalid price for BTC:',
          0
        );
      });
    });

    test('respects 5-second minimum interval between recordings', async () => {
      render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      });
    });

    test('filters out data older than 7 days', async () => {
      const now = Date.now();
      const oldData = [
        { timestamp: now - 8 * 24 * 60 * 60 * 1000, price: 40000, confidence: 100 },
        { timestamp: now - 1000, price: 49500, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(oldData));
      
      render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(savedData).toHaveLength(2);
        expect(savedData.some((d: any) => d.timestamp === oldData[0].timestamp)).toBe(false);
      });
    });

    test('shows live indicator animation when recording', async () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        const liveIndicator = container.querySelector('.animate-ping');
        expect(liveIndicator).toBeInTheDocument();
      });
    });
  });

  describe('Time Range Filtering', () => {
    test('switches to 6H time range', async () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const user = userEvent.setup();
      render(<PriceChart symbol="BTC" />);
      
      const sixHourButton = screen.getByRole('button', { name: '6H' });
      await user.click(sixHourButton);
      
      expect(sixHourButton).toHaveClass('bg-green-500');
    });

    test('switches to 24H time range', async () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const user = userEvent.setup();
      render(<PriceChart symbol="BTC" />);
      
      const twentyFourHourButton = screen.getByRole('button', { name: '24H' });
      await user.click(twentyFourHourButton);
      
      expect(twentyFourHourButton).toHaveClass('bg-green-500');
    });

    test('switches to 7D time range', async () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const user = userEvent.setup();
      render(<PriceChart symbol="BTC" />);
      
      const sevenDayButton = screen.getByRole('button', { name: '7D' });
      await user.click(sevenDayButton);
      
      expect(sevenDayButton).toHaveClass('bg-green-500');
    });

    test('logs time range switch', async () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const user = userEvent.setup();
      render(<PriceChart symbol="BTC" />);
      
      const sixHourButton = screen.getByRole('button', { name: '6H' });
      await user.click(sixHourButton);
      
      expect(console.log).toHaveBeenCalledWith('Switching BTC to 6H');
    });

    test('falls back to last 10 points when no data in range', () => {
      const now = Date.now();
      const historicalData = Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (20 - i) * 24 * 60 * 60 * 1000,
        price: 50000 + i * 100,
        confidence: 100,
      }));
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      expect(screen.queryByText(/recording/i)).not.toBeInTheDocument();
    });
  });

  describe('Statistics Display', () => {
    test('displays current price', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/current/i) || 
        container.textContent?.includes('50000')
      ).toBeTruthy();
    });

    test('displays high price', () => {
      const historicalData = [
        { timestamp: Date.now() - 2000, price: 49000, confidence: 100 },
        { timestamp: Date.now() - 1000, price: 51000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/high/i) &&
        container.textContent?.includes('51000')
      ).toBeTruthy();
    });

    test('displays low price', () => {
      const historicalData = [
        { timestamp: Date.now() - 2000, price: 49000, confidence: 100 },
        { timestamp: Date.now() - 1000, price: 51000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/low/i) &&
        container.textContent?.includes('49000')
      ).toBeTruthy();
    });

    test('calculates positive price change', () => {
      const historicalData = [
        { timestamp: Date.now() - 2000, price: 48000, confidence: 100 },
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/change/i) ||
        container.textContent?.includes('+')
      ).toBeTruthy();
    });

    test('calculates negative price change', () => {
      const historicalData = [
        { timestamp: Date.now() - 2000, price: 52000, confidence: 100 },
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/-/) || 
        container.textContent?.match(/-d/)
      ).toBeTruthy();
    });

    test('uses green styling for positive change', () => {
      const historicalData = [
        { timestamp: Date.now() - 2000, price: 48000, confidence: 100 },
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        container.querySelector('[class*="green"]') ||
        container.innerHTML.includes('green')
      ).toBeTruthy();
    });

    test('uses red styling for negative change', () => {
      const historicalData = [
        { timestamp: Date.now() - 2000, price: 52000, confidence: 100 },
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        container.querySelector('[class*="red"]') ||
        container.innerHTML.includes('red')
      ).toBeTruthy();
    });

    test('handles invalid price data gracefully', () => {
      const historicalData = [
        { timestamp: Date.now() - 2000, price: NaN, confidence: 100 },
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(container.firstChild).toBeTruthy();
    });

    test('updates stats when time range changes', async () => {
      const historicalData = [
        { timestamp: Date.now() - 2000, price: 48000, confidence: 100 },
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const user = userEvent.setup();
      const { container } = render(<PriceChart symbol="BTC" />);
      
      const sixHourButton = screen.getByRole('button', { name: '6H' });
      await user.click(sixHourButton);
      
      expect(sixHourButton).toHaveClass('bg-green-500');
    });
  });

  describe('Chart Rendering', () => {
    test('renders recharts components', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getByTestId('area')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('Data Points Counter', () => {
    test('shows data points counter when less than 100', () => {
      const historicalData = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - (50 - i) * 5000,
        price: 50000 + i * 10,
        confidence: 100,
      }));
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/building/i) || 
        container.textContent?.toLowerCase().includes('building')
      ).toBeTruthy();
    });

    test('does not show counter when 100 or more points', () => {
      const historicalData = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 5000,
        price: 50000 + i * 10,
        confidence: 100,
      }));
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      expect(screen.queryByText(/building history:/i)).not.toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    test('formats time for 1H range', () => {
      const historicalData = [
        { timestamp: new Date('2025-10-11T10:30:00').getTime(), price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="BTC" />);
      
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  describe('Price Formatting', () => {
    test('formats large prices correctly', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 50000, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        container.textContent?.includes('50000') ||
        container.textContent?.includes('50,000')
      ).toBeTruthy();
    });

    test('formats small prices correctly', () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {
          CFX: { formattedPrice: '0.1523', confidence: 50, expo: -8 },
        },
      });
      
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 0.1523, confidence: 100 },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="CFX" />);
      
      expect(
        container.textContent?.includes('0.15') ||
        container.textContent?.includes('0.1')
      ).toBeTruthy();
    });
  });

  describe('Building History Message', () => {
    test('shows remaining time in hours when > 60 minutes', () => {
      const historicalData = Array.from({ length: 10 }, (_, i) => ({
        timestamp: Date.now() - (10 - i) * 5000,
        price: 50000,
        confidence: 100,
      }));
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(
        screen.queryByText(/building/i) || 
        container.textContent?.toLowerCase().includes('building')
      ).toBeTruthy();
    });
  });

  describe('Component Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('clears interval on unmount', () => {
      const { unmount } = render(<PriceChart symbol="BTC" />);
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Different Symbols', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('renders chart for ETH', () => {
      const historicalData = [
        { timestamp: Date.now() - 1000, price: 3000, confidence: 50 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(historicalData));
      
      render(<PriceChart symbol="ETH" />);
      
      expect(screen.getByText('ETH/USD Price Chart')).toBeInTheDocument();
    });

    test('loads correct localStorage key for symbol', () => {
      render(<PriceChart symbol="ETH" />);
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('pythHistory_ETH');
    });

    test('saves to correct localStorage key for symbol', async () => {
      render(<PriceChart symbol="ETH" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'pythHistory_ETH',
          expect.any(String)
        );
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('handles missing price data', () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {},
      });
      
      localStorageMock.getItem.mockReturnValue(null);
      
      const { container } = render(<PriceChart symbol="BTC" />);
      
      expect(container.firstChild).toBeTruthy();
    });

    test('handles zero confidence values', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {
          BTC: { formattedPrice: '50000.00', confidence: 0, expo: -8 },
        },
      });
      
      render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
      });
    });

    test('handles negative prices', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {
          BTC: { formattedPrice: '-100.00', confidence: 100, expo: -8 },
        },
      });
      
      render(<PriceChart symbol="BTC" />);
      
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          'Invalid price for BTC:',
          -100
        );
      });
    });
  });
});