/**
 * Input Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows required indicator', () => {
    render(<Input label="Email" required />);
    
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<Input label="Email" error="Invalid email" />);
    
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveClass('border-red-300');
  });

  it('displays helper text', () => {
    render(<Input label="Email" helperText="Enter your email address" />);
    
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
  });

  it('handles input changes', () => {
    const handleChange = jest.fn();
    render(<Input label="Email" onChange={handleChange} />);
    
    const input = screen.getByLabelText(/email/i);
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('can be disabled', () => {
    render(<Input label="Email" disabled />);
    
    const input = screen.getByLabelText(/email/i);
    expect(input).toBeDisabled();
  });
});