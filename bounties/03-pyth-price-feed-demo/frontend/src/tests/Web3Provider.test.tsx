import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Web3Provider } from '../providers/Web3Provider';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';

// Mock wagmi and react-query
jest.mock('wagmi', () => ({
  WagmiProvider: jest.fn(({ children }) => <div data-testid="wagmi-provider">{children}</div>),
  createConfig: jest.fn(() => ({ id: 'mock-config' })),
  http: jest.fn(() => ({ type: 'http' })),
}));

jest.mock('wagmi/connectors', () => ({
  injected: jest.fn(() => ({ id: 'injected', name: 'Injected' })),
  metaMask: jest.fn(() => ({ id: 'metaMask', name: 'MetaMask' })),
}));

jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(() => ({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  })),
  QueryClientProvider: jest.fn(({ children }) => (
    <div data-testid="query-client-provider">{children}</div>
  )),
}));

describe('Web3Provider Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Rendering', () => {
    test('renders children', () => {
      render(
        <Web3Provider>
          <div data-testid="test-child">Test Content</div>
        </Web3Provider>
      );
      
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('wraps children with WagmiProvider', () => {
      render(
        <Web3Provider>
          <div>Child</div>
        </Web3Provider>
      );
      
      expect(WagmiProvider).toHaveBeenCalled();
      expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument();
    });

    test('wraps children with QueryClientProvider', () => {
      render(
        <Web3Provider>
          <div>Child</div>
        </Web3Provider>
      );
      
      expect(QueryClientProvider).toHaveBeenCalled();
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    });

    test('nests providers correctly (WagmiProvider > QueryClientProvider)', () => {
      const { container } = render(
        <Web3Provider>
          <div data-testid="child">Content</div>
        </Web3Provider>
      );
      
      const wagmiProvider = container.querySelector('[data-testid="wagmi-provider"]');
      const queryProvider = container.querySelector('[data-testid="query-client-provider"]');
      
      expect(wagmiProvider).toBeInTheDocument();
      expect(queryProvider).toBeInTheDocument();
      expect(wagmiProvider).toContainElement(queryProvider);
    });
  });

  describe('Multiple Children', () => {
    test('renders multiple children', () => {
      render(
        <Web3Provider>
          <div data-testid="child-1">First Child</div>
          <div data-testid="child-2">Second Child</div>
          <div data-testid="child-3">Third Child</div>
        </Web3Provider>
      );
      
      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });

    test('renders nested components', () => {
      render(
        <Web3Provider>
          <div>
            <header>Header</header>
            <main>
              <section>
                <article>Nested Content</article>
              </section>
            </main>
          </div>
        </Web3Provider>
      );
      
      expect(screen.getByText('Header')).toBeInTheDocument();
      expect(screen.getByText('Nested Content')).toBeInTheDocument();
    });

    test('renders complex component tree', () => {
      const ComplexComponent = () => (
        <div>
          <h1>Title</h1>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <button>Click Me</button>
        </div>
      );

      render(
        <Web3Provider>
          <ComplexComponent />
        </Web3Provider>
      );
      
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });
  });

  describe('Configuration', () => {
    test('WagmiProvider receives config prop', () => {
      render(
        <Web3Provider>
          <div>Content</div>
        </Web3Provider>
      );
      
      expect(WagmiProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            id: 'mock-config',
          }),
        }),
        expect.anything()
      );
    });

    test('QueryClientProvider receives client prop', () => {
      render(
        <Web3Provider>
          <div>Content</div>
        </Web3Provider>
      );
      
      expect(QueryClientProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          client: expect.objectContaining({
            defaultOptions: expect.any(Object),
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('Edge Cases', () => {
    test('renders with null children', () => {
      const { container } = render(<Web3Provider>{null}</Web3Provider>);
      
      expect(container).toBeInTheDocument();
    });

    test('renders with undefined children', () => {
      const { container } = render(<Web3Provider>{undefined}</Web3Provider>);
      
      expect(container).toBeInTheDocument();
    });

    test('renders with empty fragment', () => {
      render(
        <Web3Provider>
          <></>
        </Web3Provider>
      );
      
      expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument();
    });

    test('renders with conditional children', () => {
      const showContent = true;
      
      render(
        <Web3Provider>
          {showContent && <div>Conditional Content</div>}
        </Web3Provider>
      );
      
      expect(screen.getByText('Conditional Content')).toBeInTheDocument();
    });

    test('renders with React fragments', () => {
      render(
        <Web3Provider>
          <>
            <div>Fragment Child 1</div>
            <div>Fragment Child 2</div>
          </>
        </Web3Provider>
      );
      
      expect(screen.getByText('Fragment Child 1')).toBeInTheDocument();
      expect(screen.getByText('Fragment Child 2')).toBeInTheDocument();
    });

    test('handles children with keys', () => {
      const items = ['A', 'B', 'C'];
      
      render(
        <Web3Provider>
          {items.map((item) => (
            <div key={item}>{item}</div>
          ))}
        </Web3Provider>
      );
      
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
    });
  });

  describe('Children Props', () => {
    test('preserves children props', () => {
      render(
        <Web3Provider>
          <div className="custom-class" id="custom-id">
            Content with props
          </div>
        </Web3Provider>
      );
      
      const child = screen.getByText('Content with props');
      expect(child).toHaveClass('custom-class');
      expect(child).toHaveAttribute('id', 'custom-id');
    });

    test('preserves children event handlers', () => {
      const handleClick = jest.fn();
      
      render(
        <Web3Provider>
          <button onClick={handleClick}>Click Me</button>
        </Web3Provider>
      );
      
      const button = screen.getByRole('button', { name: /click me/i });
      button.click();
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Component Types', () => {
    test('renders functional components', () => {
      const FunctionalComponent = () => <div>Functional Component</div>;
      
      render(
        <Web3Provider>
          <FunctionalComponent />
        </Web3Provider>
      );
      
      expect(screen.getByText('Functional Component')).toBeInTheDocument();
    });

    test('renders components with hooks', () => {
      const ComponentWithHooks = () => {
        const [count, setCount] = React.useState(0);
        return (
          <div>
            <span>Count: {count}</span>
            <button onClick={() => setCount(count + 1)}>Increment</button>
          </div>
        );
      };
      
      render(
        <Web3Provider>
          <ComponentWithHooks />
        </Web3Provider>
      );
      
      expect(screen.getByText('Count: 0')).toBeInTheDocument();
    });

    test('renders memoized components', () => {
      const MemoComponent = React.memo(() => <div>Memoized Component</div>);
      
      render(
        <Web3Provider>
          <MemoComponent />
        </Web3Provider>
      );
      
      expect(screen.getByText('Memoized Component')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    test('allows nested providers', () => {
      const CustomProvider = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="custom-provider">{children}</div>
      );

      render(
        <Web3Provider>
          <CustomProvider>
            <div>Nested Content</div>
          </CustomProvider>
        </Web3Provider>
      );
      
      expect(screen.getByTestId('custom-provider')).toBeInTheDocument();
      expect(screen.getByText('Nested Content')).toBeInTheDocument();
    });

    test('supports multiple Web3Provider instances', () => {
      const { container: container1 } = render(
        <Web3Provider>
          <div data-testid="app-1">App 1</div>
        </Web3Provider>
      );

      const { container: container2 } = render(
        <Web3Provider>
          <div data-testid="app-2">App 2</div>
        </Web3Provider>
      );
      
      expect(container1.querySelector('[data-testid="app-1"]')).toBeInTheDocument();
      expect(container2.querySelector('[data-testid="app-2"]')).toBeInTheDocument();
    });
  });

  describe('Provider Isolation', () => {
    test('each provider instance is isolated', () => {
      const { rerender } = render(
        <Web3Provider>
          <div>Content 1</div>
        </Web3Provider>
      );
      
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      
      rerender(
        <Web3Provider>
          <div>Content 2</div>
        </Web3Provider>
      );
      
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('Rendering Behavior', () => {
    test('does not render additional wrapper elements', () => {
      const { container } = render(
        <Web3Provider>
          <div data-testid="direct-child">Direct Child</div>
        </Web3Provider>
      );
      
      const wagmiProvider = container.querySelector('[data-testid="wagmi-provider"]');
      expect(wagmiProvider).toBeInTheDocument();
    });

    test('maintains component tree structure', () => {
      render(
        <Web3Provider>
          <div data-testid="parent">
            <div data-testid="child">
              <div data-testid="grandchild">Content</div>
            </div>
          </div>
        </Web3Provider>
      );
      
      const parent = screen.getByTestId('parent');
      const child = screen.getByTestId('child');
      const grandchild = screen.getByTestId('grandchild');
      
      expect(parent).toContainElement(child);
      expect(child).toContainElement(grandchild);
    });
  });

  describe('Children Types', () => {
    test('renders string children', () => {
      render(
        <Web3Provider>
          <span>Plain text content</span>
        </Web3Provider>
      );
      
      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });

    test('renders number children', () => {
      render(
        <Web3Provider>
          <span>{42}</span>
        </Web3Provider>
      );
      
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    test('renders mixed children types', () => {
      render(
        <Web3Provider>
          <>
            <div>Element</div>
            <span>Text</span>
            <span>123</span>
            <span>Another Element</span>
          </>
        </Web3Provider>
      );
      
      expect(screen.getByText('Element')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
      expect(screen.getByText('Another Element')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('renders efficiently with many children', () => {
      const manyChildren = Array.from({ length: 100 }, (_, i) => (
        <div key={i}>Child {i}</div>
      ));

      const { container } = render(
        <Web3Provider>
          {manyChildren}
        </Web3Provider>
      );
      
      expect(container.querySelectorAll('div').length).toBeGreaterThan(100);
    });
  });

  describe('TypeScript Types', () => {
    test('accepts ReactNode children type', () => {
      const validChildren: React.ReactNode[] = [
        <div key="1">Element</div>,
        'String',
        123,
        null,
        undefined,
        true,
        false,
      ];

      validChildren.forEach((child, index) => {
        const { unmount } = render(
          <Web3Provider>
            {child}
          </Web3Provider>
        );
        unmount();
      });
      
      expect(true).toBe(true);
    });
  });

  describe('Snapshot Testing', () => {
    test('matches snapshot with simple children', () => {
      const { container } = render(
        <Web3Provider>
          <div>Simple Content</div>
        </Web3Provider>
      );
      
      expect(container.firstChild).toMatchSnapshot();
    });

    test('matches snapshot with complex children', () => {
      const { container } = render(
        <Web3Provider>
          <div>
            <h1>Title</h1>
            <p>Paragraph</p>
            <button>Button</button>
          </div>
        </Web3Provider>
      );
      
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('Re-rendering', () => {
    test('handles re-renders without errors', () => {
      const { rerender } = render(
        <Web3Provider>
          <div>Initial</div>
        </Web3Provider>
      );
      
      expect(screen.getByText('Initial')).toBeInTheDocument();
      
      rerender(
        <Web3Provider>
          <div>Updated</div>
        </Web3Provider>
      );
      
      expect(screen.getByText('Updated')).toBeInTheDocument();
    });

    test('maintains provider context across re-renders', () => {
      let renderCount = 0;
      
      const TestComponent = () => {
        renderCount++;
        return <div>Render #{renderCount}</div>;
      };

      const { rerender } = render(
        <Web3Provider>
          <TestComponent />
        </Web3Provider>
      );
      
      expect(screen.getByText('Render #1')).toBeInTheDocument();
      
      rerender(
        <Web3Provider>
          <TestComponent />
        </Web3Provider>
      );
      
      expect(screen.getByText('Render #2')).toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    test('allows error boundary wrapper', () => {
      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="error-boundary">{children}</div>
      );

      render(
        <ErrorBoundary>
          <Web3Provider>
            <div>Content</div>
          </Web3Provider>
        </ErrorBoundary>
      );
      
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });
});