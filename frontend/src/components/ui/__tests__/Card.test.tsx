/**
 * Card Component Tests
 * カードコンポーネントのユニットテスト
 */

import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../Card';

describe('Card Components', () => {
  describe('Card', () => {
    it('renders card with children', () => {
      render(
        <div data-testid="card">
          <Card>
            <div>Card content</div>
          </Card>
        </div>
      );
      
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <div data-testid="wrapper">
          <Card className="custom-card">Content</Card>
        </div>
      );
      const card = screen.getByTestId('wrapper').firstChild;
      expect(card).toHaveClass('custom-card');
    });

    it('applies default card styles', () => {
      render(
        <div data-testid="wrapper">
          <Card>Content</Card>
        </div>
      );
      const card = screen.getByTestId('wrapper').firstChild;
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-white', 'shadow-sm');
    });

    it('applies padding classes correctly', () => {
      const { rerender } = render(
        <div data-testid="wrapper">
          <Card padding="sm">Content</Card>
        </div>
      );
      expect(screen.getByTestId('wrapper').firstChild).toHaveClass('p-4');

      rerender(
        <div data-testid="wrapper">
          <Card padding="md">Content</Card>
        </div>
      );
      expect(screen.getByTestId('wrapper').firstChild).toHaveClass('p-6');

      rerender(
        <div data-testid="wrapper">
          <Card padding="lg">Content</Card>
        </div>
      );
      expect(screen.getByTestId('wrapper').firstChild).toHaveClass('p-8');
    });
  });

  describe('CardHeader', () => {
    it('renders header with children', () => {
      render(
        <div data-testid="wrapper">
          <CardHeader>
            <div>Header content</div>
          </CardHeader>
        </div>
      );
      
      expect(screen.getByTestId('wrapper')).toBeInTheDocument();
      expect(screen.getByText('Header content')).toBeInTheDocument();
    });

    it('applies header styles', () => {
      render(
        <div data-testid="wrapper">
          <CardHeader>Header</CardHeader>
        </div>
      );
      const header = screen.getByTestId('wrapper').firstChild;
      expect(header).toHaveClass('mb-4');
    });
  });

  describe('CardTitle', () => {
    it('renders title with correct heading level', () => {
      render(<CardTitle>Card Title</CardTitle>);
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Card Title');
    });

    it('applies title styles', () => {
      render(<CardTitle>Title</CardTitle>);
      const title = screen.getByRole('heading');
      expect(title).toHaveClass('text-lg', 'font-semibold', 'text-gray-900');
    });
  });

  // CardDescription component does not exist in the actual implementation

  describe('CardContent', () => {
    it('renders content with children', () => {
      render(
        <div data-testid="wrapper">
          <CardContent>
            <p>Card content</p>
          </CardContent>
        </div>
      );
      
      expect(screen.getByTestId('wrapper')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('applies content styles', () => {
      render(
        <div data-testid="wrapper">
          <CardContent>Content</CardContent>
        </div>
      );
      const content = screen.getByTestId('wrapper').firstChild;
      expect(content).toHaveClass('text-gray-600');
    });
  });

  describe('CardFooter', () => {
    it('renders footer with children', () => {
      render(
        <div data-testid="wrapper">
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </div>
      );
      
      expect(screen.getByTestId('wrapper')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('applies footer styles', () => {
      render(
        <div data-testid="wrapper">
          <CardFooter>Footer</CardFooter>
        </div>
      );
      const footer = screen.getByTestId('wrapper').firstChild;
      expect(footer).toHaveClass('mt-4', 'pt-4', 'border-t', 'border-gray-100');
    });
  });

  describe('Complete Card Structure', () => {
    it('renders complete card with all components', () => {
      render(
        <div data-testid="complete-card">
          <Card>
            <CardHeader>
              <CardTitle>Test Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Main content goes here</p>
            </CardContent>
            <CardFooter>
              <button>Action Button</button>
            </CardFooter>
          </Card>
        </div>
      );

      expect(screen.getByTestId('complete-card')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Test Card' })).toBeInTheDocument();
      expect(screen.getByText('Main content goes here')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
    });
  });
});