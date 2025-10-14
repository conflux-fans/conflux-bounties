import React from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout from './layout';

// Mock the components
jest.mock('@/components/providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <div data-testid="providers">{children}</div>
}));

jest.mock('@/components/auth/user-auth-wrapper', () => ({
  UserAuthWrapper: ({ children }: { children: React.ReactNode }) => <div data-testid="user-auth-wrapper">{children}</div>
}));

// Mock Next.js font
jest.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'mocked-inter-font'
  })
}));

describe('RootLayout', () => {
  it('should render with correct HTML structure', () => {
    render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    expect(screen.getByTestId('providers')).toBeInTheDocument();
    expect(screen.getByTestId('user-auth-wrapper')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should have correct HTML attributes', () => {
    const { container } = render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    const html = container.querySelector('html');
    const body = container.querySelector('body');

    expect(html).toHaveAttribute('lang', 'en');
    expect(body).toHaveClass('mocked-inter-font');
  });

  it('should render children correctly', () => {
    const testContent = <div data-testid="test-child">Child Component</div>;
    
    render(<RootLayout>{testContent}</RootLayout>);

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Child Component')).toBeInTheDocument();
  });

  it('should have correct component hierarchy', () => {
    const { container } = render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    );

    const html = container.querySelector('html');
    const body = html?.querySelector('body');
    const providers = body?.querySelector('[data-testid="providers"]');
    const userAuthWrapper = providers?.querySelector('[data-testid="user-auth-wrapper"]');

    expect(html).toBeInTheDocument();
    expect(body).toBeInTheDocument();
    expect(providers).toBeInTheDocument();
    expect(userAuthWrapper).toBeInTheDocument();
  });

  it('should handle empty children', () => {
    render(<RootLayout>{null}</RootLayout>);

    expect(screen.getByTestId('providers')).toBeInTheDocument();
    expect(screen.getByTestId('user-auth-wrapper')).toBeInTheDocument();
  });

  it('should handle multiple children', () => {
    render(
      <RootLayout>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </RootLayout>
    );

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });
});
