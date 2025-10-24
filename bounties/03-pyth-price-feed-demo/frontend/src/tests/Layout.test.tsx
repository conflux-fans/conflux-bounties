import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Layout from '../components/Layout';
import WalletConnect from '../components/WalletConnect';

// Mock WalletConnect component
jest.mock('../components/WalletConnect', () => {
  return function MockWalletConnect() {
    return <div data-testid="wallet-connect">WalletConnect Mock</div>;
  };
});

describe('Layout Component', () => {
  const mockChildren = <div data-testid="test-child">Test Children Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Structure', () => {
    test('renders the layout with all main sections', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
    });

    test('applies correct background gradient classes', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('min-h-screen', 'bg-gradient-to-br', 'from-blue-50', 'to-indigo-100');
    });

    test('renders header with white background and shadow', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('bg-white', 'shadow-md');
    });
  });

  describe('Header Section', () => {
    test('renders the logo image', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const logo = screen.getByRole('img', { name: /logo/i });
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/confi.png');
      expect(logo).toHaveAttribute('alt', 'Logo');
    });

    test('logo has correct styling classes', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const logo = screen.getByRole('img', { name: /logo/i });
      expect(logo).toHaveClass('w-full', 'h-full', 'object-contain');
    });

    test('logo container has correct dimensions', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const logoContainer = container.querySelector('.w-10.h-10.rounded-lg');
      expect(logoContainer).toBeInTheDocument();
    });

    test('renders main title', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      expect(screen.getByText('Pyth Price Feed')).toBeInTheDocument();
    });

    test('main title has correct styling', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const title = screen.getByText('Pyth Price Feed');
      expect(title).toHaveClass('text-2xl', 'font-bold', 'text-gray-900');
    });

    test('renders subtitle', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      expect(screen.getByText('Conflux eSpace Integration')).toBeInTheDocument();
    });

    test('subtitle has correct styling', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const subtitle = screen.getByText('Conflux eSpace Integration');
      expect(subtitle).toHaveClass('text-sm', 'text-gray-600');
    });

    test('renders WalletConnect component', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      expect(screen.getByTestId('wallet-connect')).toBeInTheDocument();
    });

    test('header content is properly aligned', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const headerContent = container.querySelector('.flex.items-center.justify-between');
      expect(headerContent).toBeInTheDocument();
    });

    test('logo and title are grouped together', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const logoTitleGroup = container.querySelector('.flex.items-center.space-x-3');
      expect(logoTitleGroup).toBeInTheDocument();
    });
  });

  describe('Main Content Section', () => {
    test('renders children content', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Test Children Content')).toBeInTheDocument();
    });

    test('children are rendered inside main element', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const main = screen.getByRole('main');
      const child = screen.getByTestId('test-child');
      
      expect(main).toContainElement(child);
    });

    test('main element has container and padding classes', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const main = screen.getByRole('main');
      expect(main).toHaveClass('container', 'mx-auto', 'px-4', 'py-8');
    });

    test('renders multiple children', () => {
      const multipleChildren = (
        <>
          <div data-testid="child-1">First Child</div>
          <div data-testid="child-2">Second Child</div>
          <div data-testid="child-3">Third Child</div>
        </>
      );

      render(<Layout>{multipleChildren}</Layout>);
      
      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });

    test('renders complex nested children', () => {
      const complexChildren = (
        <div>
          <h1>Page Title</h1>
          <section>
            <p>Content paragraph</p>
            <button>Action Button</button>
          </section>
        </div>
      );

      render(<Layout>{complexChildren}</Layout>);
      
      expect(screen.getByText('Page Title')).toBeInTheDocument();
      expect(screen.getByText('Content paragraph')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /action button/i })).toBeInTheDocument();
    });

    test('renders when no children provided', () => {
      render(<Layout>{undefined}</Layout>);
      
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toBeEmptyDOMElement();
    });
  });

  describe('Footer Section', () => {
    test('renders footer description', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      expect(screen.getByText('Pyth Price Feed Demo Dapp - Testing Purpose')).toBeInTheDocument();
    });

    test('footer has correct styling classes', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveClass('bg-white', 'mt-12', 'border-t', 'border-gray-200');
    });

    test('footer content has correct layout', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const footerContent = container.querySelector('.flex.items-center.justify-between.text-sm.text-gray-600');
      expect(footerContent).toBeInTheDocument();
    });
  });

  describe('Footer Links', () => {
    test('renders Pyth Docs link', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const pythLink = screen.getByRole('link', { name: /pyth docs/i });
      expect(pythLink).toBeInTheDocument();
    });

    test('Pyth Docs link has correct attributes', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const pythLink = screen.getByRole('link', { name: /pyth docs/i });
      expect(pythLink).toHaveAttribute('href', 'https://docs.pyth.network');
      expect(pythLink).toHaveAttribute('target', '_blank');
      expect(pythLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('Pyth Docs link has hover styling', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const pythLink = screen.getByRole('link', { name: /pyth docs/i });
      expect(pythLink).toHaveClass('hover:text-blue-600');
    });

    test('renders Conflux Docs link', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const confluxLink = screen.getByRole('link', { name: /conflux docs/i });
      expect(confluxLink).toBeInTheDocument();
    });

    test('Conflux Docs link has correct attributes', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const confluxLink = screen.getByRole('link', { name: /conflux docs/i });
      expect(confluxLink).toHaveAttribute('href', 'https://doc.confluxnetwork.org');
      expect(confluxLink).toHaveAttribute('target', '_blank');
      expect(confluxLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('Conflux Docs link has hover styling', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const confluxLink = screen.getByRole('link', { name: /conflux docs/i });
      expect(confluxLink).toHaveClass('hover:text-blue-600');
    });

    test('renders GitHub link', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const githubLink = screen.getByRole('link', { name: /github/i });
      expect(githubLink).toBeInTheDocument();
    });

    test('GitHub link has correct attributes', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const githubLink = screen.getByRole('link', { name: /github/i });
      expect(githubLink).toHaveAttribute('href', 'https://github.com/AmirMP12');
      expect(githubLink).toHaveAttribute('target', '_blank');
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('GitHub link has hover styling', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const githubLink = screen.getByRole('link', { name: /github/i });
      expect(githubLink).toHaveClass('hover:text-blue-600');
    });

    test('renders all three footer links', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const footer = screen.getByRole('contentinfo');
      const links = within(footer).getAllByRole('link');
      
      expect(links).toHaveLength(3);
    });

    test('footer links have correct spacing', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const linksContainer = container.querySelector('.flex.space-x-6');
      expect(linksContainer).toBeInTheDocument();
      
      const links = within(linksContainer as HTMLElement).getAllByRole('link');
      expect(links).toHaveLength(3);
    });

    test('all external links open in new tab securely', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const footer = screen.getByRole('contentinfo');
      const links = within(footer).getAllByRole('link');
      
      links.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });

  describe('Responsive Layout', () => {
    test('header uses container class for responsive width', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const headerContainer = container.querySelector('header .container');
      expect(headerContainer).toBeInTheDocument();
      expect(headerContainer).toHaveClass('mx-auto', 'px-4', 'py-4');
    });

    test('main uses container class for responsive width', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const main = screen.getByRole('main');
      expect(main).toHaveClass('container', 'mx-auto');
    });

    test('footer uses container class for responsive width', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const footerContainer = container.querySelector('footer .container');
      expect(footerContainer).toBeInTheDocument();
      expect(footerContainer).toHaveClass('mx-auto', 'px-4', 'py-6');
    });
  });

  describe('Accessibility', () => {
    test('uses semantic HTML elements', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
    });

    test('logo image has alt text', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const logo = screen.getByRole('img', { name: /logo/i });
      expect(logo).toHaveAttribute('alt', 'Logo');
    });

    test('all links are accessible', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const pythLink = screen.getByRole('link', { name: /pyth docs/i });
      const confluxLink = screen.getByRole('link', { name: /conflux docs/i });
      const githubLink = screen.getByRole('link', { name: /github/i });
      
      expect(pythLink).toBeInTheDocument();
      expect(confluxLink).toBeInTheDocument();
      expect(githubLink).toBeInTheDocument();
    });

    test('heading hierarchy is correct', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const heading = screen.getByRole('heading', { name: /pyth price feed/i });
      expect(heading.tagName).toBe('H1');
    });
  });

  describe('Visual Hierarchy', () => {
    test('title is styled as heading level 1', () => {
      render(<Layout>{mockChildren}</Layout>);
      
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent('Pyth Price Feed');
    });

    test('footer text has proper text sizing', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const footerText = container.querySelector('.text-sm.text-gray-600');
      expect(footerText).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    test('WalletConnect is positioned correctly in header', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      const header = screen.getByRole('banner');
      const walletConnect = screen.getByTestId('wallet-connect');
      
      expect(header).toContainElement(walletConnect);
    });

    test('renders with real component structure', () => {
      const realPageContent = (
        <div className="page-content">
          <h2>Dashboard</h2>
          <div className="widgets">
            <div>Widget 1</div>
            <div>Widget 2</div>
          </div>
        </div>
      );

      render(<Layout>{realPageContent}</Layout>);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Widget 1')).toBeInTheDocument();
      expect(screen.getByText('Widget 2')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles null children gracefully', () => {
      const { container } = render(<Layout>{null}</Layout>);
      
      expect(container).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    test('handles empty string children', () => {
      render(<Layout>{''}</Layout>);
      
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
    });

    test('handles React fragment as children', () => {
      render(
        <Layout>
          <>
            <div>Fragment Child 1</div>
            <div>Fragment Child 2</div>
          </>
        </Layout>
      );
      
      expect(screen.getByText('Fragment Child 1')).toBeInTheDocument();
      expect(screen.getByText('Fragment Child 2')).toBeInTheDocument();
    });

    test('handles conditional children rendering', () => {
      const showContent = true;
      
      render(
        <Layout>
          {showContent && <div>Conditional Content</div>}
        </Layout>
      );
      
      expect(screen.getByText('Conditional Content')).toBeInTheDocument();
    });
  });

  describe('Snapshot Testing', () => {
    test('matches snapshot with basic children', () => {
      const { container } = render(<Layout>{mockChildren}</Layout>);
      
      expect(container.firstChild).toMatchSnapshot();
    });

    test('matches snapshot with complex children', () => {
      const complexChildren = (
        <div>
          <h1>Test Page</h1>
          <p>Test content</p>
        </div>
      );

      const { container } = render(<Layout>{complexChildren}</Layout>);
      
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});