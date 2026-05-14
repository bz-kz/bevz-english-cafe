import { render, screen, fireEvent } from '@testing-library/react';
import { BookingConfirmDialog } from '../BookingConfirmDialog';

const slot = {
  id: 'a',
  start_at: '2026-06-15T10:00:00+09:00',
  end_at: '2026-06-15T10:30:00+09:00',
  lesson_type: 'private' as const,
  capacity: 1,
  booked_count: 0,
  remaining: 1,
  price_yen: null,
  status: 'open' as const,
};

describe('BookingConfirmDialog', () => {
  it('returns null when slot is null', () => {
    const { container } = render(
      <BookingConfirmDialog
        slot={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders date + time when slot is given', () => {
    render(
      <BookingConfirmDialog
        slot={slot}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText(/予約しますか/)).toBeInTheDocument();
  });

  it('calls onConfirm when 予約する is clicked', () => {
    const onConfirm = jest.fn();
    render(
      <BookingConfirmDialog
        slot={slot}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '予約する' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when キャンセル is clicked', () => {
    const onCancel = jest.fn();
    render(
      <BookingConfirmDialog
        slot={slot}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
