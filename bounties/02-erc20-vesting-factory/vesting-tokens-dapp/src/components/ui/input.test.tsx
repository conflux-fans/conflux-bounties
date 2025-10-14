import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Input } from './input';

describe('Input Component', () => {
  it('should render input with default props', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    // Check for some key classes instead of the full string
    expect(input).toHaveClass('flex', 'w-full', 'rounded-md', 'border');
  });

  it('should render input with custom className', () => {
    render(<Input className="custom-class" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });

  it('should render input with placeholder', () => {
    render(<Input placeholder="Enter text here" />);
    const input = screen.getByPlaceholderText('Enter text here');
    expect(input).toBeInTheDocument();
  });

  it('should render input with value', () => {
    render(<Input value="test value" onChange={() => {}} />);
    const input = screen.getByDisplayValue('test value');
    expect(input).toBeInTheDocument();
  });

  it('should render disabled input', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should render input with type', () => {
    render(<Input type="password" />);
    const input = screen.getByDisplayValue(''); // password inputs don't have textbox role
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should render input with id', () => {
    render(<Input id="test-input" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'test-input');
  });

  it('should render input with name', () => {
    render(<Input name="test-name" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('name', 'test-name');
  });

  it('should render input with required attribute', () => {
    render(<Input required />);
    const input = screen.getByRole('textbox');
    expect(input).toBeRequired();
  });

  it('should render input with aria-label', () => {
    render(<Input aria-label="Test input" />);
    const input = screen.getByLabelText('Test input');
    expect(input).toBeInTheDocument();
  });

  it('should render input with data-testid', () => {
    render(<Input data-testid="test-input" />);
    const input = screen.getByTestId('test-input');
    expect(input).toBeInTheDocument();
  });
}); 