import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Label } from './label';

describe('Label Component', () => {
  it('should render label with default props', () => {
    render(<Label>Test Label</Label>);
    const label = screen.getByText('Test Label');
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none');
  });

  it('should render label with custom className', () => {
    render(<Label className="custom-class">Test Label</Label>);
    const label = screen.getByText('Test Label');
    expect(label).toHaveClass('custom-class');
  });

  it('should render label with htmlFor attribute', () => {
    render(<Label htmlFor="test-input">Test Label</Label>);
    const label = screen.getByText('Test Label');
    expect(label).toHaveAttribute('for', 'test-input');
  });

  it('should render label with id', () => {
    render(<Label id="test-label">Test Label</Label>);
    const label = screen.getByText('Test Label');
    expect(label).toHaveAttribute('id', 'test-label');
  });

  it('should render label with data-testid', () => {
    render(<Label data-testid="test-label">Test Label</Label>);
    const label = screen.getByTestId('test-label');
    expect(label).toBeInTheDocument();
  });

  it('should render label with complex children', () => {
    render(<Label data-testid="complex-label">Complex <strong>Label</strong> Text</Label>);
    const label = screen.getByTestId('complex-label');
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent('Complex Label Text');
    expect(label).toContainHTML('<strong>Label</strong>');
  });

  it('should render label with empty children', () => {
    render(<Label data-testid="empty-label"></Label>);
    const label = screen.getByTestId('empty-label');
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent('');
  });
}); 