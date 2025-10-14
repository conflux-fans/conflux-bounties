import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}));

describe('Card Components', () => {
  describe('Card', () => {
    it('should render with default props', () => {
      render(<Card>Card content</Card>);
      
      const card = screen.getByText('Card content');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('rounded-xl border bg-card text-card-foreground shadow');
    });

    it('should render with custom className', () => {
      render(<Card className="custom-card">Custom Card</Card>);
      
      const card = screen.getByText('Custom Card');
      expect(card).toHaveClass('custom-card');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref}>Ref Card</Card>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should handle HTML attributes', () => {
      render(
        <Card
          data-testid="test-card"
          aria-label="Test card"
          role="article"
        >
          Test Card
        </Card>
      );
      
      const card = screen.getByTestId('test-card');
      expect(card).toHaveAttribute('aria-label', 'Test card');
      expect(card).toHaveAttribute('role', 'article');
    });

    it('should handle empty children', () => {
      render(<Card data-testid="empty-card"></Card>);
      
      const card = screen.getByTestId('empty-card');
      expect(card).toBeInTheDocument();
    });

    it('should handle null children', () => {
      render(<Card data-testid="null-card">{null}</Card>);
      
      const card = screen.getByTestId('null-card');
      expect(card).toBeInTheDocument();
    });
  });

  describe('CardHeader', () => {
    it('should render with default props', () => {
      render(<CardHeader>Header content</CardHeader>);
      
      const header = screen.getByText('Header content');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('flex flex-col space-y-1.5 p-6');
    });

    it('should render with custom className', () => {
      render(<CardHeader className="custom-header">Custom Header</CardHeader>);
      
      const header = screen.getByText('Custom Header');
      expect(header).toHaveClass('custom-header');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardHeader ref={ref}>Ref Header</CardHeader>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should handle HTML attributes', () => {
      render(
        <CardHeader
          data-testid="test-header"
          aria-label="Test header"
        >
          Test Header
        </CardHeader>
      );
      
      const header = screen.getByTestId('test-header');
      expect(header).toHaveAttribute('aria-label', 'Test header');
    });
  });

  describe('CardTitle', () => {
    it('should render with default props', () => {
      render(<CardTitle>Card Title</CardTitle>);
      
      const title = screen.getByText('Card Title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('font-semibold leading-none tracking-tight');
    });

    it('should render with custom className', () => {
      render(<CardTitle className="custom-title">Custom Title</CardTitle>);
      
      const title = screen.getByText('Custom Title');
      expect(title).toHaveClass('custom-title');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardTitle ref={ref}>Ref Title</CardTitle>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should handle HTML attributes', () => {
      render(
        <CardTitle
          data-testid="test-title"
          aria-label="Test title"
        >
          Test Title
        </CardTitle>
      );
      
      const title = screen.getByTestId('test-title');
      expect(title).toHaveAttribute('aria-label', 'Test title');
    });
  });

  describe('CardDescription', () => {
    it('should render with default props', () => {
      render(<CardDescription>Card Description</CardDescription>);
      
      const description = screen.getByText('Card Description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('text-sm text-muted-foreground');
    });

    it('should render with custom className', () => {
      render(<CardDescription className="custom-description">Custom Description</CardDescription>);
      
      const description = screen.getByText('Custom Description');
      expect(description).toHaveClass('custom-description');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardDescription ref={ref}>Ref Description</CardDescription>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should handle HTML attributes', () => {
      render(
        <CardDescription
          data-testid="test-description"
          aria-label="Test description"
        >
          Test Description
        </CardDescription>
      );
      
      const description = screen.getByTestId('test-description');
      expect(description).toHaveAttribute('aria-label', 'Test description');
    });
  });

  describe('CardContent', () => {
    it('should render with default props', () => {
      render(<CardContent>Content</CardContent>);
      
      const content = screen.getByText('Content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass('p-6 pt-0');
    });

    it('should render with custom className', () => {
      render(<CardContent className="custom-content">Custom Content</CardContent>);
      
      const content = screen.getByText('Custom Content');
      expect(content).toHaveClass('custom-content');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardContent ref={ref}>Ref Content</CardContent>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should handle HTML attributes', () => {
      render(
        <CardContent
          data-testid="test-content"
          aria-label="Test content"
        >
          Test Content
        </CardContent>
      );
      
      const content = screen.getByTestId('test-content');
      expect(content).toHaveAttribute('aria-label', 'Test content');
    });
  });

  describe('CardFooter', () => {
    it('should render with default props', () => {
      render(<CardFooter>Footer content</CardFooter>);
      
      const footer = screen.getByText('Footer content');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass('flex items-center p-6 pt-0');
    });

    it('should render with custom className', () => {
      render(<CardFooter className="custom-footer">Custom Footer</CardFooter>);
      
      const footer = screen.getByText('Custom Footer');
      expect(footer).toHaveClass('custom-footer');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardFooter ref={ref}>Ref Footer</CardFooter>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should handle HTML attributes', () => {
      render(
        <CardFooter
          data-testid="test-footer"
          aria-label="Test footer"
        >
          Test Footer
        </CardFooter>
      );
      
      const footer = screen.getByTestId('test-footer');
      expect(footer).toHaveAttribute('aria-label', 'Test footer');
    });
  });

  describe('Card Composition', () => {
    it('should render complete card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
            <CardDescription>Test Description</CardDescription>
          </CardHeader>
          <CardContent>Test Content</CardContent>
          <CardFooter>Test Footer</CardFooter>
        </Card>
      );
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByText('Test Footer')).toBeInTheDocument();
    });

    it('should handle nested card components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Outer Card</CardTitle>
          </CardHeader>
          <CardContent>
            <Card>
              <CardHeader>
                <CardTitle>Inner Card</CardTitle>
              </CardHeader>
              <CardContent>Inner Content</CardContent>
            </Card>
          </CardContent>
        </Card>
      );
      
      expect(screen.getByText('Outer Card')).toBeInTheDocument();
      expect(screen.getByText('Inner Card')).toBeInTheDocument();
      expect(screen.getByText('Inner Content')).toBeInTheDocument();
    });

    it('should handle complex content structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Complex Card</CardTitle>
            <CardDescription>With complex content</CardDescription>
          </CardHeader>
          <CardContent>
            <div data-testid="complex-content">
              <p>Paragraph 1</p>
              <p>Paragraph 2</p>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <button>Action 1</button>
            <button>Action 2</button>
          </CardFooter>
        </Card>
      );
      
      expect(screen.getByText('Complex Card')).toBeInTheDocument();
      expect(screen.getByText('With complex content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Action 2')).toBeInTheDocument();
    });

    it('should handle empty content in all sections', () => {
      render(
        <Card data-testid="empty-sections-card">
          <CardHeader></CardHeader>
          <CardContent></CardContent>
          <CardFooter></CardFooter>
        </Card>
      );
      
      const card = screen.getByTestId('empty-sections-card');
      expect(card).toBeInTheDocument();
    });

    it('should handle mixed content types', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Mixed Content</CardTitle>
            <CardDescription>With various elements</CardDescription>
          </CardHeader>
          <CardContent>
            <span>Text content</span>
            <div data-testid="div-content">Div content</div>
            <button>Button content</button>
          </CardContent>
          <CardFooter>
            <input placeholder="Input content" />
            <select>
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
          </CardFooter>
        </Card>
      );
      
      expect(screen.getByText('Mixed Content')).toBeInTheDocument();
      expect(screen.getByText('With various elements')).toBeInTheDocument();
      expect(screen.getByText('Text content')).toBeInTheDocument();
      expect(screen.getByTestId('div-content')).toBeInTheDocument();
      expect(screen.getByText('Button content')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Input content')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });
  });
});
