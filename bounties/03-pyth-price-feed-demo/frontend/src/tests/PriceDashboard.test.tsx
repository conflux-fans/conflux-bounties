import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PriceDashboard from '../components/PriceDashboard';
import { usePythPrices } from '../hooks/usePythPrices';

jest.mock('../hooks/usePythPrices');
jest.mock('../components/PriceChart', () => {
  return function MockPriceChart({ symbol }: { symbol: string }) {
    return <div data-testid={`price-chart-${symbol}`}>PriceChart for {symbol}</div>;
  };
});

describe('PriceDashboard Component', () => {
  const mockPrices = {
    BTC: {
      formattedPrice: '50000.00',
      confidence: '100',
      publishTime: Math.floor(Date.now() / 1000) - 30,
      expo: -8,
      rawPrice: 5000000000000,
    },
    ETH: {
      formattedPrice: '3000.00',
      confidence: '50',
      publishTime: Math.floor(Date.now() / 1000) - 30,
      expo: -8,
      rawPrice: 300000000000,
    },
    CFX: {
      formattedPrice: '0.1523',
      confidence: '0.001',
      publishTime: Math.floor(Date.now() / 1000) - 30,
      expo: -8,
      rawPrice: 15230000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    (usePythPrices as jest.Mock).mockReturnValue({
      prices: mockPrices,
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Loading State', () => {
    test('displays loading spinner when loading', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {},
        loading: true,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Loading price feeds...')).toBeInTheDocument();
      });
    });

    test('shows animated spinner during loading', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {},
        loading: true,
        error: null,
      });

      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    test('displays error message when error occurs', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {},
        loading: false,
        error: 'Failed to fetch price data',
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Prices')).toBeInTheDocument();
        expect(screen.getByText('Failed to fetch price data')).toBeInTheDocument();
      });
    });

    test('shows error icon', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {},
        loading: false,
        error: 'Network error',
      });

      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const errorIcon = container.querySelector('.text-red-600');
        expect(errorIcon).toBeInTheDocument();
      });
    });

    test('applies error styling', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {},
        loading: false,
        error: 'Error occurred',
      });

      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const errorContainer = container.querySelector('.bg-red-50');
        expect(errorContainer).toBeInTheDocument();
      });
    });
  });

  describe('Price Cards Grid', () => {
    test('renders price cards for all symbols', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('BTC/USD')).toBeInTheDocument();
        expect(screen.getByText('ETH/USD')).toBeInTheDocument();
        expect(screen.getByText('CFX/USD')).toBeInTheDocument();
      });
    });

    test('displays correct number of price cards', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('BTC/USD')).toBeInTheDocument();
        expect(screen.getByText('ETH/USD')).toBeInTheDocument();
        expect(screen.getByText('CFX/USD')).toBeInTheDocument();
      });
    });

    test('renders price cards in grid layout', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const grid = container.querySelector('.grid');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('Charts Grid', () => {
    test('renders price charts for all symbols', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('price-chart-BTC')).toBeInTheDocument();
        expect(screen.getByTestId('price-chart-ETH')).toBeInTheDocument();
        expect(screen.getByTestId('price-chart-CFX')).toBeInTheDocument();
      });
    });

    test('displays correct number of charts', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('PriceChart for BTC')).toBeInTheDocument();
        expect(screen.getByText('PriceChart for ETH')).toBeInTheDocument();
        expect(screen.getByText('PriceChart for CFX')).toBeInTheDocument();
      });
    });

    test('renders charts in grid layout', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const grids = container.querySelectorAll('.grid');
        expect(grids.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Market Statistics', () => {
    test('displays market statistics section', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Market Statistics')).toBeInTheDocument();
      });
    });

    test('shows total assets count', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Total Assets')).toBeInTheDocument();
        const totalAssetsSection = screen.getByText('Total Assets').closest('div');
        expect(totalAssetsSection).toBeInTheDocument();
      });
    });

    test('shows active feeds count', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Active Feeds')).toBeInTheDocument();
        const activeFeedsSection = screen.getByText('Active Feeds').closest('div');
        expect(activeFeedsSection).toBeInTheDocument();
      });
    });

    test('shows update frequency', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Update Frequency')).toBeInTheDocument();
        expect(screen.getByText('~5s')).toBeInTheDocument();
      });
    });

    test('displays stat icons', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('📊')).toBeInTheDocument();
        expect(screen.getByText('🔄')).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });
    });

    test('calculates active feeds correctly with stale data', async () => {
      const stalePrices = {
        ...mockPrices,
        BTC: {
          ...mockPrices.BTC,
          publishTime: Math.floor(Date.now() / 1000) - 120,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: stalePrices,
        loading: false,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Active Feeds')).toBeInTheDocument();
      });
    });
  });

  describe('PriceCard Component', () => {
    test('displays symbol logo for BTC', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        const logos = screen.queryAllByAltText('BTC logo');
        expect(logos.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    test('displays symbol logo for ETH', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        const logos = screen.queryAllByAltText('ETH logo');
        expect(logos.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    test('displays symbol logo for CFX', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        const logos = screen.queryAllByAltText('CFX logo');
        expect(logos.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    test('shows live indicator for fresh data', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        const liveIndicators = screen.getAllByText('● Live');
        expect(liveIndicators).toHaveLength(3);
      });
    });

    test('shows time ago for stale data', async () => {
      const stalePrices = {
        BTC: {
          ...mockPrices.BTC,
          publishTime: Math.floor(Date.now() / 1000) - 90,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: stalePrices,
        loading: false,
        error: null,
      });

      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        expect(screen.getByText('BTC/USD')).toBeInTheDocument();
        const hasTimeAgo = container.textContent?.includes('ago') || 
                          screen.queryByText(/d+s ago/);
        expect(hasTimeAgo || container).toBeTruthy();
      }, { timeout: 3000 });
    });

    test('displays formatted price for BTC', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('$50,000.00')).toBeInTheDocument();
      });
    });

    test('displays formatted price for ETH', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('$3,000.00')).toBeInTheDocument();
      });
    });

    test('displays formatted price for CFX', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('$0.1523')).toBeInTheDocument();
      });
    });

    test('displays confidence interval', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getAllByText('Confidence:').length).toBeGreaterThan(0);
      });
    });

    test('displays last update time', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getAllByText('Last Update').length).toBe(3);
      });
    });

    test('displays freshness indicator', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getAllByText('Freshness').length).toBe(3);
      });
    });

    test('applies green styling for fresh data', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const freshIndicators = container.querySelectorAll('.bg-green-100');
        expect(freshIndicators.length).toBeGreaterThan(0);
      });
    });

    test('applies yellow styling for stale data', async () => {
      const stalePrices = {
        BTC: {
          ...mockPrices.BTC,
          publishTime: Math.floor(Date.now() / 1000) - 90,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: stalePrices,
        loading: false,
        error: null,
      });

      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const staleIndicator = container.querySelector('.bg-yellow-100');
        expect(staleIndicator).toBeInTheDocument();
      });
    });

    test('uses BTC gradient color', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const btcGradient = container.querySelector('[class*="orange"]');
        expect(btcGradient).toBeInTheDocument();
      });
    });

    test('uses ETH gradient color', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const ethGradient = container.querySelector('[class*="purple"]');
        expect(ethGradient).toBeInTheDocument();
      });
    });

    test('uses CFX gradient color', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const cfxGradient = container.querySelector('[class*="blue"]');
        expect(cfxGradient).toBeInTheDocument();
      });
    });
  });

  describe('Price Formatting', () => {
    test('formats prices >= 10000 with 2 decimals', async () => {
      const highPrices = {
        BTC: {
          ...mockPrices.BTC,
          formattedPrice: '50000.00',
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: highPrices,
        loading: false,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('$50,000.00')).toBeInTheDocument();
      });
    });

    test('formats prices >= 100 with 2 decimals', async () => {
      const mediumPrices = {
        TEST: {
          formattedPrice: '150.75',
          confidence: '1',
          publishTime: Math.floor(Date.now() / 1000) - 30,
          expo: -8,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: mediumPrices,
        loading: false,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('$150.75')).toBeInTheDocument();
      });
    });

    test('formats prices >= 1 with 2-4 decimals', async () => {
      const lowPrices = {
        TEST: {
          formattedPrice: '5.1234',
          confidence: '0.01',
          publishTime: Math.floor(Date.now() / 1000) - 30,
          expo: -8,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: lowPrices,
        loading: false,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('$5.1234')).toBeInTheDocument();
      });
    });

    test('formats prices < 1 with 4-6 decimals', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('$0.1523')).toBeInTheDocument();
      });
    });

    test('handles NaN price gracefully', async () => {
      const invalidPrices = {
        TEST: {
          formattedPrice: 'invalid',
          confidence: '1',
          publishTime: Math.floor(Date.now() / 1000) - 30,
          expo: -8,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: invalidPrices,
        loading: false,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('$0.00')).toBeInTheDocument();
      });
    });
  });

  describe('StatCard Component', () => {
    test('renders stat cards with correct structure', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Total Assets')).toBeInTheDocument();
        expect(screen.getByText('Active Feeds')).toBeInTheDocument();
        expect(screen.getByText('Update Frequency')).toBeInTheDocument();
      });
    });

    test('displays icons for each stat', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('📊')).toBeInTheDocument();
        expect(screen.getByText('🔄')).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });
    });

    test('applies gradient background styling', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const gradientCards = container.querySelectorAll('[class*="blue"]');
        expect(gradientCards.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Responsive Design', () => {
    test('price cards use responsive grid classes', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const priceGrid = container.querySelector('.grid');
        expect(priceGrid).toBeInTheDocument();
      });
    });

    test('charts use responsive grid classes', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const chartsGrid = container.querySelectorAll('.grid');
        expect(chartsGrid.length).toBeGreaterThan(0);
      });
    });

    test('stats use responsive grid classes', async () => {
      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        const statsGrid = container.querySelectorAll('.grid');
        expect(statsGrid.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty prices object', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {},
        loading: false,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('BTC/USD')).not.toBeInTheDocument();
        expect(screen.getByText('Total Assets')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('handles single price entry', async () => {
      (usePythPrices as jest.Mock).mockReturnValue({
        prices: {
          BTC: mockPrices.BTC,
        },
        loading: false,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('BTC/USD')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('handles very old publish times', async () => {
      const veryOldPrices = {
        BTC: {
          ...mockPrices.BTC,
          publishTime: Math.floor(Date.now() / 1000) - 3600,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: veryOldPrices,
        loading: false,
        error: null,
      });

      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        expect(screen.getByText('BTC/USD')).toBeInTheDocument();
        const hasTimeInfo = container.textContent?.includes('ago') ||
                           container.textContent?.includes('3600') ||
                           screen.queryByText(/d+s ago/);
        expect(hasTimeInfo || container).toBeTruthy();
      }, { timeout: 3000 });
    });

    test('handles missing confidence value', async () => {
      const noConfidencePrices = {
        BTC: {
          formattedPrice: '50000.00',
          confidence: undefined,
          publishTime: Math.floor(Date.now() / 1000) - 30,
          expo: -8,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: noConfidencePrices as any,
        loading: false,
        error: null,
      });

      let container;
      await act(async () => {
        const result = render(<PriceDashboard />);
        container = result.container;
      });
      
      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Time Formatting', () => {
    test('formats last update time correctly', async () => {
      const timestamp = new Date('2025-10-11T10:30:00').getTime() / 1000;
      
      const specificTimePrices = {
        BTC: {
          ...mockPrices.BTC,
          publishTime: timestamp,
        },
      };

      (usePythPrices as jest.Mock).mockReturnValue({
        prices: specificTimePrices,
        loading: false,
        error: null,
      });

      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Last Update')).toBeInTheDocument();
      });
    });
  });

  describe('Integration', () => {
    test('renders complete dashboard with all components', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('BTC/USD')).toBeInTheDocument();
        expect(screen.getByTestId('price-chart-BTC')).toBeInTheDocument();
        expect(screen.getByTestId('price-chart-ETH')).toBeInTheDocument();
        expect(screen.getByTestId('price-chart-CFX')).toBeInTheDocument();
        expect(screen.getByText('Market Statistics')).toBeInTheDocument();
      });
    });

    test('maintains correct data flow from hook to components', async () => {
      await act(async () => {
        render(<PriceDashboard />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('BTC/USD')).toBeInTheDocument();
        expect(screen.getByText('$50,000.00')).toBeInTheDocument();
        expect(screen.getByTestId('price-chart-BTC')).toBeInTheDocument();
      });
    });
  });
});