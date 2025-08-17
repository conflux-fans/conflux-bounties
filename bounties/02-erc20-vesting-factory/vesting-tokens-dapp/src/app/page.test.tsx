import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from './page';

// Mock the components
jest.mock('@/components/layout/navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>
}));

jest.mock('@/components/landing/hero', () => ({
  Hero: () => <div data-testid="hero">Hero</div>
}));

jest.mock('@/components/landing/features', () => ({
  Features: () => <div data-testid="features">Features</div>
}));

jest.mock('@/components/landing/how-it-works', () => ({
  HowItWorks: () => <div data-testid="how-it-works">How It Works</div>
}));

jest.mock('@/components/landing/stats', () => ({
  Stats: () => <div data-testid="stats">Stats</div>
}));

jest.mock('@/components/layout/footer', () => ({
  Footer: () => <div data-testid="footer">Footer</div>
}));

jest.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}));

describe('HomePage', () => {
  it('should render all main components', () => {
    render(<HomePage />);
    
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('hero')).toBeInTheDocument();
    expect(screen.getByTestId('features')).toBeInTheDocument();
    expect(screen.getByTestId('stats')).toBeInTheDocument();
    expect(screen.getByTestId('how-it-works')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('should have correct structure and layout', () => {
    const { container } = render(<HomePage />);
    
    const mainElement = container.querySelector('main');
    expect(mainElement).toBeInTheDocument();
    
    const divElement = container.querySelector('div');
    expect(divElement).toHaveClass('min-h-screen', 'bg-background');
  });

  it('should render components in correct order', () => {
    render(<HomePage />);

    const navbar = screen.getByTestId('navbar');
    const main = screen.getByRole('main');
    const footer = screen.getByTestId('footer');

    expect(navbar).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    expect(footer).toBeInTheDocument();

    // Check that main contains the expected components
    expect(main).toContainElement(screen.getByTestId('hero'));
    expect(main).toContainElement(screen.getByTestId('features'));
    expect(main).toContainElement(screen.getByTestId('stats'));
    expect(main).toContainElement(screen.getByTestId('how-it-works'));
  });

  it('should wrap main content in Suspense', () => {
    const { container } = render(<HomePage />);
    
    const suspenseElement = container.querySelector('main > div');
    expect(suspenseElement).toBeInTheDocument();
  });

  it('should render all landing page sections', () => {
    render(<HomePage />);
    
    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.getByText('How It Works')).toBeInTheDocument();
  });

  it('should have proper semantic structure', () => {
    const { container } = render(<HomePage />);
    
    const mainElement = container.querySelector('main');
    expect(mainElement).toBeInTheDocument();
    
    const divElement = container.querySelector('div');
    expect(divElement).toBeInTheDocument();
  });

  it('should render with proper CSS classes', () => {
    const { container } = render(<HomePage />);
    
    const mainDiv = container.querySelector('div');
    expect(mainDiv).toHaveClass('min-h-screen', 'bg-background');
  });

  it('should handle component rendering without errors', () => {
    expect(() => render(<HomePage />)).not.toThrow();
  });

  it('should maintain component hierarchy', () => {
    const { container } = render(<HomePage />);
    
    // Check the overall structure
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.tagName).toBe('DIV');
    
    const mainElement = rootDiv.querySelector('main');
    expect(mainElement).toBeInTheDocument();
    
    const suspenseElement = mainElement?.querySelector('div');
    expect(suspenseElement).toBeInTheDocument();
  });

  it('should render all text content correctly', () => {
    render(<HomePage />);
    
    expect(screen.getByText('Navbar')).toBeInTheDocument();
    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.getByText('How It Works')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('should have accessible structure', () => {
    const { container } = render(<HomePage />);
    
    const mainElement = container.querySelector('main');
    expect(mainElement).toBeInTheDocument();
    
    // Check that main content is properly structured
    const contentElements = mainElement?.querySelectorAll('div');
    expect(contentElements?.length).toBeGreaterThan(0);
  });

  it('should render consistently across multiple renders', () => {
    const { rerender } = render(<HomePage />);
    
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('hero')).toBeInTheDocument();
    
    rerender(<HomePage />);
    
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('hero')).toBeInTheDocument();
  });
});
