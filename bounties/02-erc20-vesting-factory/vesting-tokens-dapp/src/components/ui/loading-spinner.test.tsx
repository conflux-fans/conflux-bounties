import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './loading-spinner';

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}));

describe('LoadingSpinner', () => {
  it('should render with default props', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-6');
    expect(spinner).toHaveClass('w-6');
  });

  it('should render with custom size', () => {
    render(<LoadingSpinner size="lg" />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-8');
    expect(spinner).toHaveClass('w-8');
  });

  it('should render with custom className', () => {
    render(<LoadingSpinner className="custom-class" />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('custom-class');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('should render with small size', () => {
    render(<LoadingSpinner size="sm" />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-4');
    expect(spinner).toHaveClass('w-4');
  });

  it('should render with medium size', () => {
    render(<LoadingSpinner size="md" />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-6');
    expect(spinner).toHaveClass('w-6');
  });

  it('should render with large size', () => {
    render(<LoadingSpinner size="lg" />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-8');
    expect(spinner).toHaveClass('w-8');
  });

  it('should combine custom className with default classes', () => {
    render(<LoadingSpinner className="text-blue-500" size="lg" />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('text-blue-500');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-8');
    expect(spinner).toHaveClass('w-8');
  });

  it('should handle empty className', () => {
    render(<LoadingSpinner className="" />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-6');
    expect(spinner).toHaveClass('w-6');
  });

  it('should handle undefined className', () => {
    render(<LoadingSpinner className={undefined} />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-6');
    expect(spinner).toHaveClass('w-6');
  });

  it('should handle null className', () => {
    render(<LoadingSpinner className={null as any} />);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('h-6');
    expect(spinner).toHaveClass('w-6');
  });

  it('should render container with correct classes', () => {
    render(<LoadingSpinner />);
    const container = screen.getByTestId('loading-container');
    expect(container).toHaveClass('flex items-center justify-center p-4');
  });
});
