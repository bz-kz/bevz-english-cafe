import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForceCancelDialog } from '../ForceCancelDialog';
import * as lib from '@/lib/admin-booking';

jest.mock('@/lib/firebase', () => ({
  firebaseAuth: { currentUser: { getIdToken: () => Promise.resolve('t') } },
}));
jest.mock('@/lib/admin-booking');
const mocked = lib as jest.Mocked<typeof lib>;

describe('ForceCancelDialog', () => {
  beforeEach(() => {
    mocked.adminForceCancel.mockResolvedValue({
      id: 'b1',
      status: 'cancelled',
      cancelled_at: '2026-05-15T01:00:00Z',
    });
  });
  afterEach(() => jest.clearAllMocks());

  it('shows quota checkbox for non-trial', () => {
    render(
      <ForceCancelDialog
        bookingId="b1"
        userLabel="taro@example.com"
        lessonType="group"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(screen.getByLabelText(/quota.*返却/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/trial.*返却/)).not.toBeInTheDocument();
  });

  it('shows trial checkbox for trial', () => {
    render(
      <ForceCancelDialog
        bookingId="b1"
        userLabel="taro@example.com"
        lessonType="trial"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(screen.getByLabelText(/trial.*返却/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/quota.*返却/)).not.toBeInTheDocument();
  });

  it('calls adminForceCancel with selected flags', async () => {
    const onSuccess = jest.fn();
    render(
      <ForceCancelDialog
        bookingId="b1"
        userLabel="taro@example.com"
        lessonType="group"
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />
    );
    fireEvent.click(screen.getByLabelText(/quota.*返却/));
    fireEvent.click(screen.getByRole('button', { name: /キャンセルする/ }));
    await waitFor(() => {
      expect(mocked.adminForceCancel).toHaveBeenCalledWith('b1', {
        refund_quota: true,
        refund_trial: false,
      });
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
