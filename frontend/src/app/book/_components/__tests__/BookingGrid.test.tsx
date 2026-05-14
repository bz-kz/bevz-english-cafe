import { render, screen } from '@testing-library/react';
import { BookingGrid } from '../BookingGrid';

const startJST = '2026-06-15T09:00:00+09:00';

const slot = (overrides = {}) => ({
  id: 'a',
  start_at: startJST,
  end_at: '2026-06-15T09:30:00+09:00',
  lesson_type: 'private' as const,
  capacity: 1,
  booked_count: 0,
  remaining: 1,
  price_yen: null,
  status: 'open' as const,
  ...overrides,
});

describe('BookingGrid', () => {
  it('renders 14 day-headers when given start date', () => {
    render(
      <BookingGrid
        startDate={new Date('2026-06-15T00:00:00+09:00')}
        slots={[]}
        bookings={[]}
        onCellClick={jest.fn()}
      />
    );
    const headers = screen.getAllByTestId('day-header');
    expect(headers).toHaveLength(14);
  });

  it('renders 14 time-row labels (9:00 ... 15:30)', () => {
    render(
      <BookingGrid
        startDate={new Date('2026-06-15T00:00:00+09:00')}
        slots={[]}
        bookings={[]}
        onCellClick={jest.fn()}
      />
    );
    expect(screen.getByText('9:00')).toBeInTheDocument();
    expect(screen.getByText('15:30')).toBeInTheDocument();
    const rowLabels = screen.getAllByTestId('time-row');
    expect(rowLabels).toHaveLength(14);
  });

  it('places ○ cell for matching open slot', () => {
    render(
      <BookingGrid
        startDate={new Date('2026-06-15T00:00:00+09:00')}
        slots={[slot()]}
        bookings={[]}
        onCellClick={jest.fn()}
      />
    );
    expect(screen.getAllByText('○')).toHaveLength(1);
  });
});
