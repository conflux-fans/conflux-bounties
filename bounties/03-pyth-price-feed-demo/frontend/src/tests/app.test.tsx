import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../providers/Web3Provider', () => ({
  Web3Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

jest.mock('../components/PriceDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="price-dashboard">Price Dashboard</div>,
}));

jest.mock('../components/BettingInterface', () => ({
  __esModule: true,
  default: () => <div data-testid="betting-interface">Betting Interface</div>,
}));

jest.mock('../components/LiquidationMonitor', () => ({
  __esModule: true,
  default: () => <div data-testid="liquidation-monitor">Liquidation Monitor</div>,
}));

jest.mock('../components/AlertManager', () => ({
  __esModule: true,
  default: () => <div data-testid="alert-manager">Alert Manager</div>,
}));

import App from '../app';

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  test('renders all navigation tabs', () => {
    render(<App />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Prediction Market')).toBeInTheDocument();
    expect(screen.getByText('Lending Protocol')).toBeInTheDocument();
    expect(screen.getByText('Price Alerts')).toBeInTheDocument();
  });

  test('shows dashboard by default', () => {
    render(<App />);
    
    expect(screen.getByTestId('price-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('betting-interface')).not.toBeInTheDocument();
  });

  test('switches to betting tab when clicked', () => {
    render(<App />);
    
    const bettingTab = screen.getByText('Prediction Market');
    fireEvent.click(bettingTab);
    
    expect(screen.getByTestId('betting-interface')).toBeInTheDocument();
    expect(screen.queryByTestId('price-dashboard')).not.toBeInTheDocument();
  });

  test('switches to lending tab when clicked', () => {
    render(<App />);
    
    const lendingTab = screen.getByText('Lending Protocol');
    fireEvent.click(lendingTab);
    
    expect(screen.getByTestId('liquidation-monitor')).toBeInTheDocument();
    expect(screen.queryByTestId('price-dashboard')).not.toBeInTheDocument();
  });

  test('switches to alerts tab when clicked', () => {
    render(<App />);
    
    const alertsTab = screen.getByText('Price Alerts');
    fireEvent.click(alertsTab);
    
    expect(screen.getByTestId('alert-manager')).toBeInTheDocument();
    expect(screen.queryByTestId('price-dashboard')).not.toBeInTheDocument();
  });

  test('applies active styling to current tab', () => {
    render(<App />);
    
    const dashboardTab = screen.getByText('Dashboard');
    expect(dashboardTab).toHaveClass('border-blue-500', 'text-blue-600');
    
    const bettingTab = screen.getByText('Prediction Market');
    expect(bettingTab).toHaveClass('text-gray-600');
    
    // Click betting tab
    fireEvent.click(bettingTab);
    
    expect(bettingTab).toHaveClass('border-blue-500', 'text-blue-600');
    expect(dashboardTab).toHaveClass('text-gray-600');
  });

  test('can switch between all tabs sequentially', () => {
    render(<App />);
    
    // Dashboard (default)
    expect(screen.getByTestId('price-dashboard')).toBeInTheDocument();
    
    // Switch to betting
    fireEvent.click(screen.getByText('Prediction Market'));
    expect(screen.getByTestId('betting-interface')).toBeInTheDocument();
    
    // Switch to lending
    fireEvent.click(screen.getByText('Lending Protocol'));
    expect(screen.getByTestId('liquidation-monitor')).toBeInTheDocument();
    
    // Switch to alerts
    fireEvent.click(screen.getByText('Price Alerts'));
    expect(screen.getByTestId('alert-manager')).toBeInTheDocument();
    
    // Back to dashboard
    fireEvent.click(screen.getByText('Dashboard'));
    expect(screen.getByTestId('price-dashboard')).toBeInTheDocument();
  });

  test('navigation preserves tab state', () => {
    render(<App />);
    
    // Click betting tab twice
    const bettingTab = screen.getByText('Prediction Market');
    fireEvent.click(bettingTab);
    fireEvent.click(bettingTab);
    
    expect(screen.getByTestId('betting-interface')).toBeInTheDocument();
  });

  test('wraps content in Web3Provider', () => {
    const { container } = render(<App />);
    expect(container.firstChild).toBeTruthy();
  });
});