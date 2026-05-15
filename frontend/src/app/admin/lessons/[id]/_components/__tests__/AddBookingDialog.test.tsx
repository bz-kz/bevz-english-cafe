import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AddBookingDialog } from '../AddBookingDialog';
import * as lib from '@/lib/admin-booking';

jest.mock('@/lib/firebase', () => ({
  firebaseAuth: { currentUser: { getIdToken: () => Promise.resolve('t') } },
}));
jest.mock('@/lib/admin-booking');
const mocked = lib as jest.Mocked<typeof lib>;

describe('AddBookingDialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mocked.searchAdminUsers.mockResolvedValue([
      { uid: 'u1', email: 'taro@example.com', name: '山田太郎' },
    ]);
    mocked.adminForceBook.mockResolvedValue({
      id: 'b1',
      slot_id: 's1',
      user_id: 'u1',
      status: 'confirmed',
      created_at: '',
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('shows quota checkbox for non-trial lesson_type', () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    render(
      <AddBookingDialog
        slotId="s1"
        lessonType="group"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
    expect(screen.getByLabelText(/quota.*消費/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/trial.*消費/)).not.toBeInTheDocument();
  });

  it('shows trial checkbox for trial lesson_type', () => {
    render(
      <AddBookingDialog
        slotId="s1"
        lessonType="trial"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(screen.getByLabelText(/trial.*消費/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/quota.*消費/)).not.toBeInTheDocument();
  });

  it('calls adminForceBook with chosen flags on submit', async () => {
    const onSuccess = jest.fn();
    render(
      <AddBookingDialog
        slotId="s1"
        lessonType="group"
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />
    );
    // pick a user
    fireEvent.change(screen.getByPlaceholderText(/メール.*名前.*検索/), {
      target: { value: 'taro' },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.click(await screen.findByText(/taro@example.com/));
    // toggle quota
    fireEvent.click(screen.getByLabelText(/quota.*消費/));
    // submit
    fireEvent.click(screen.getByRole('button', { name: /予約を追加/ }));
    await waitFor(() => {
      expect(mocked.adminForceBook).toHaveBeenCalledWith('s1', {
        user_id: 'u1',
        consume_quota: true,
        consume_trial: false,
      });
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
