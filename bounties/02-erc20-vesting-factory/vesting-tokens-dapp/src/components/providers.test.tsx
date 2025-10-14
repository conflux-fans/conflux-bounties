import React from 'react';
import { render, screen } from '@testing-library/react';
import { Providers } from './providers';

// Mock the dependencies
jest.mock('wagmi', () => ({
  WagmiProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="wagmi-provider">{children}</div>
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="rainbowkit-provider">{children}</div>
}));

jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="query-client-provider">{children}</div>
}));

jest.mock('@/lib/web3/config', () => ({
  config: {}
}));

jest.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>
}));

jest.mock('next-nprogress-bar', () => ({
  AppProgressBar: ({ height, color, options, shallowRouting }: any) => (
    <div 
      data-testid="progress-bar"
      data-height={height}
      data-color={color}
      data-shallow-routing={shallowRouting}
    >
      Progress Bar
    </div>
  )
}));

// Mock CSS import
jest.mock('@rainbow-me/rainbowkit/styles.css', () => ({}));

describe('Providers', () => {
  it('should render all provider components', () => {
    render(
      <Providers>
        <div>Test Child</div>
      </Providers>
    );

    expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('rainbowkit-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('should render children correctly', () => {
    render(
      <Providers>
        <div data-testid="test-child">Test Child Content</div>
      </Providers>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Child Content')).toBeInTheDocument();
  });

  it('should render progress bar with correct props', () => {
    render(
      <Providers>
        <div>Test Child</div>
      </Providers>
    );

    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveAttribute('data-height', '4px');
    expect(progressBar).toHaveAttribute('data-color', '#000');
    expect(progressBar).toHaveAttribute('data-shallow-routing', 'true');
  });

  it('should render multiple children', () => {
    render(
      <Providers>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </Providers>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });

  it('should render empty children', () => {
    render(<Providers>{}</Providers>);

    expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('rainbowkit-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('should render complex nested children', () => {
    render(
      <Providers>
        <div data-testid="parent">
          <span data-testid="nested-child">Nested Content</span>
          <button data-testid="button-child">Click me</button>
        </div>
      </Providers>
    );

    expect(screen.getByTestId('parent')).toBeInTheDocument();
    expect(screen.getByTestId('nested-child')).toBeInTheDocument();
    expect(screen.getByTestId('button-child')).toBeInTheDocument();
    expect(screen.getByText('Nested Content')).toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should maintain provider hierarchy', () => {
    const { container } = render(
      <Providers>
        <div data-testid="test-child">Test</div>
      </Providers>
    );

    // Check that providers are nested in the correct order
    const wagmiProvider = container.querySelector('[data-testid="wagmi-provider"]');
    const queryClientProvider = container.querySelector('[data-testid="query-client-provider"]');
    const rainbowKitProvider = container.querySelector('[data-testid="rainbowkit-provider"]');

    expect(wagmiProvider).toContainElement(queryClientProvider);
    expect(queryClientProvider).toContainElement(rainbowKitProvider);
  });

  it('should render with null children', () => {
    render(<Providers>{null}</Providers>);

    expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('rainbowkit-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('should render with undefined children', () => {
    render(<Providers>{undefined}</Providers>);

    expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('rainbowkit-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });
});
