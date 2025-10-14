import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}));

describe('Button', () => {
  it('should render with default props', () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0');
    expect(button).toHaveClass('bg-primary text-primary-foreground shadow hover:bg-primary/90');
    expect(button).toHaveClass('h-9 px-4 py-2');
  });

  it('should render with custom className', () => {
    render(<Button className="custom-class">Custom Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Custom Button' });
    expect(button).toHaveClass('custom-class');
  });

  it('should render with different variants', () => {
    const { rerender } = render(<Button variant="destructive">Destructive</Button>);
    
    let button = screen.getByRole('button', { name: 'Destructive' });
    expect(button).toHaveClass('bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90');

    rerender(<Button variant="outline">Outline</Button>);
    button = screen.getByRole('button', { name: 'Outline' });
    expect(button).toHaveClass('border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground');

    rerender(<Button variant="secondary">Secondary</Button>);
    button = screen.getByRole('button', { name: 'Secondary' });
    expect(button).toHaveClass('bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80');

    rerender(<Button variant="ghost">Ghost</Button>);
    button = screen.getByRole('button', { name: 'Ghost' });
    expect(button).toHaveClass('hover:bg-accent hover:text-accent-foreground');

    rerender(<Button variant="link">Link</Button>);
    button = screen.getByRole('button', { name: 'Link' });
    expect(button).toHaveClass('text-primary underline-offset-4 hover:underline');
  });

  it('should render with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    
    let button = screen.getByRole('button', { name: 'Small' });
    expect(button).toHaveClass('h-8 rounded-md px-3 text-xs');

    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole('button', { name: 'Large' });
    expect(button).toHaveClass('h-10 rounded-md px-8');

    rerender(<Button size="icon">Icon</Button>);
    button = screen.getByRole('button', { name: 'Icon' });
    expect(button).toHaveClass('h-9 w-9');
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Clickable</Button>);
    
    const button = screen.getByRole('button', { name: 'Clickable' });
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:pointer-events-none disabled:opacity-50');
  });

  it('should render as child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    
    const link = screen.getByRole('link', { name: 'Link Button' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('should forward ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('should handle all HTML button attributes', () => {
    render(
      <Button
        type="submit"
        name="test-button"
        value="test-value"
        form="test-form"
        aria-label="Accessible button"
        data-testid="test-button"
      >
        Submit
      </Button>
    );
    
    const button = screen.getByTestId('test-button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('name', 'test-button');
    expect(button).toHaveAttribute('value', 'test-value');
    expect(button).toHaveAttribute('form', 'test-form');
    expect(button).toHaveAttribute('aria-label', 'Accessible button');
    expect(button).toHaveAttribute('data-testid', 'test-button');
  });

  it('should combine variant and size classes correctly', () => {
    render(
      <Button variant="outline" size="lg" className="extra-class">
        Combined
      </Button>
    );
    
    const button = screen.getByRole('button', { name: 'Combined' });
    expect(button).toHaveClass('border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground');
    expect(button).toHaveClass('h-10 rounded-md px-8');
    expect(button).toHaveClass('extra-class');
  });

  it('should handle empty children', () => {
    render(<Button></Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should handle null children', () => {
    render(<Button>{null}</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should handle undefined children', () => {
    render(<Button>{undefined}</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with icon and text', () => {
    render(
      <Button>
        <span>Icon</span>
        <svg data-testid="icon">Icon</svg>
      </Button>
    );
    
    const button = screen.getByRole('button', { name: 'Icon Icon' });
    const icon = screen.getByTestId('icon');
    
    expect(button).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
    expect(button).toHaveClass('[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0');
  });

  it('should handle focus and keyboard events', async () => {
    const user = userEvent.setup();
    
    render(<Button>Focusable</Button>);
    
    const button = screen.getByRole('button', { name: 'Focusable' });
    
    await user.tab();
    expect(button).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(button).toHaveFocus();
  });

  it('should maintain button semantics when asChild is false', () => {
    render(<Button>Semantic Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Semantic Button' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('should handle complex children structure', () => {
    render(
      <Button>
        <div data-testid="wrapper">
          <span>Text</span>
          <strong>Bold</strong>
        </div>
      </Button>
    );
    
    const button = screen.getByRole('button');
    const wrapper = screen.getByTestId('wrapper');
    const text = screen.getByText('Text');
    const bold = screen.getByText('Bold');
    
    expect(button).toBeInTheDocument();
    expect(wrapper).toBeInTheDocument();
    expect(text).toBeInTheDocument();
    expect(bold).toBeInTheDocument();
  });
}); 