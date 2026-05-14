import { render, screen, fireEvent } from '@testing-library/react';
import { SlotCell } from '../SlotCell';

const slot = (overrides = {}) => ({
  id: 'a',
  start_at: '2026-06-15T10:00:00+09:00',
  end_at: '2026-06-15T10:30:00+09:00',
  lesson_type: 'private' as const,
  capacity: 1,
  booked_count: 0,
  remaining: 1,
  price_yen: null,
  status: 'open' as const,
  ...overrides,
});

describe('SlotCell', () => {
  it('renders ○ for open + available', () => {
    const onClick = jest.fn();
    render(
      <SlotCell state={{ kind: 'open', slot: slot() }} onClick={onClick} />
    );
    expect(screen.getByRole('button')).toHaveTextContent('○');
  });

  it('renders × for closed', () => {
    const onClick = jest.fn();
    render(
      <SlotCell
        state={{ kind: 'closed', slot: slot({ status: 'closed' }) }}
        onClick={onClick}
      />
    );
    expect(screen.getByText('×')).toBeInTheDocument();
  });

  it('renders × for full', () => {
    const onClick = jest.fn();
    render(
      <SlotCell
        state={{ kind: 'full', slot: slot({ remaining: 0, booked_count: 1 }) }}
        onClick={onClick}
      />
    );
    expect(screen.getByText('×')).toBeInTheDocument();
  });

  it('renders 予約済 for mine', () => {
    const onClick = jest.fn();
    render(
      <SlotCell
        state={{
          kind: 'mine',
          booking: {
            id: 'b1',
            status: 'confirmed',
            created_at: '',
            cancelled_at: null,
            slot: slot(),
          },
        }}
        onClick={onClick}
      />
    );
    expect(screen.getByText('予約済')).toBeInTheDocument();
  });

  it('renders - for empty', () => {
    const onClick = jest.fn();
    render(<SlotCell state={{ kind: 'empty' }} onClick={onClick} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('calls onClick(slot) when ○ is clicked', () => {
    const onClick = jest.fn();
    const s = slot();
    render(<SlotCell state={{ kind: 'open', slot: s }} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(s);
  });

  it('does NOT call onClick when closed/full/empty', () => {
    const onClick = jest.fn();
    const closedSlot = slot({ status: 'closed' });
    const { rerender } = render(
      <SlotCell
        state={{ kind: 'closed', slot: closedSlot }}
        onClick={onClick}
      />
    );
    fireEvent.click(screen.getByText('×'));
    rerender(<SlotCell state={{ kind: 'empty' }} onClick={onClick} />);
    fireEvent.click(screen.getByText('-'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders ▲ for within24h state and is clickable', () => {
    const onClick = jest.fn();
    const s = slot();
    render(
      <SlotCell state={{ kind: 'within24h', slot: s }} onClick={onClick} />
    );
    expect(screen.getByText('▲')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(s);
  });
});
