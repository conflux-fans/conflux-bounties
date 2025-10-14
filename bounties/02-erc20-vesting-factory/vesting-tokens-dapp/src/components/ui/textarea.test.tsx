import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Textarea } from './textarea';

describe('Textarea Component', () => {
  it('should render textarea with default props', () => {
    render(<Textarea />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    // Check for some key classes instead of the full string
    expect(textarea).toHaveClass('flex', 'w-full', 'rounded-md', 'border');
  });

  it('should render textarea with custom className', () => {
    render(<Textarea className="custom-class" />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('custom-class');
  });

  it('should render textarea with placeholder', () => {
    render(<Textarea placeholder="Enter text here" />);
    const textarea = screen.getByPlaceholderText('Enter text here');
    expect(textarea).toBeInTheDocument();
  });

  it('should render textarea with value', () => {
    render(<Textarea value="test value" onChange={() => {}} />);
    const textarea = screen.getByDisplayValue('test value');
    expect(textarea).toBeInTheDocument();
  });

  it('should render disabled textarea', () => {
    render(<Textarea disabled />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('should render textarea with id', () => {
    render(<Textarea id="test-textarea" />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('id', 'test-textarea');
  });

  it('should render textarea with name', () => {
    render(<Textarea name="test-name" />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('name', 'test-name');
  });

  it('should render textarea with required attribute', () => {
    render(<Textarea required />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeRequired();
  });

  it('should render textarea with rows attribute', () => {
    render(<Textarea rows={5} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('rows', '5');
  });

  it('should render textarea with cols attribute', () => {
    render(<Textarea cols={50} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('cols', '50');
  });

  it('should render textarea with maxLength attribute', () => {
    render(<Textarea maxLength={100} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('maxLength', '100');
  });

  it('should render textarea with readOnly attribute', () => {
    render(<Textarea readOnly />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('readOnly');
  });

  it('should render textarea with aria-label', () => {
    render(<Textarea aria-label="Test textarea" />);
    const textarea = screen.getByLabelText('Test textarea');
    expect(textarea).toBeInTheDocument();
  });

  it('should render textarea with data-testid', () => {
    render(<Textarea data-testid="test-textarea" />);
    const textarea = screen.getByTestId('test-textarea');
    expect(textarea).toBeInTheDocument();
  });
}); 