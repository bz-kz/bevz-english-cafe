import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'abc' }),
  useRouter: () => ({ push }),
}));

jest.mock('@/lib/firebase', () => ({
  firebaseAuth: { currentUser: { getIdToken: () => Promise.resolve('t') } },
}));

const adminUpdateSlot = jest.fn();
const adminDeleteSlot = jest.fn();
jest.mock('@/lib/booking', () => ({
  adminUpdateSlot: (...args: unknown[]) => adminUpdateSlot(...args),
  adminDeleteSlot: (...args: unknown[]) => adminDeleteSlot(...args),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({ success: jest.fn(), error: jest.fn() }),
}));

const get = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => get(...args) },
}));

import AdminLessonEditPage from '../page';

const baseSlot = {
  id: 'abc',
  start_at: '2026-05-20T10:00:00Z',
  end_at: '2026-05-20T10:30:00Z',
  lesson_type: 'private',
  capacity: 1,
  booked_count: 0,
  remaining: 1,
  status: 'open',
  price_yen: null,
};

describe('AdminLessonEditPage', () => {
  beforeEach(() => {
    push.mockReset();
    adminUpdateSlot.mockReset();
    adminDeleteSlot.mockReset();
    get.mockReset();
    window.confirm = jest.fn(() => true);
  });

  it('shows 枠を閉じる while status=open', async () => {
    get.mockResolvedValueOnce({ data: baseSlot });
    get.mockResolvedValueOnce({ data: [] });
    render(<AdminLessonEditPage />);
    expect(
      await screen.findByRole('button', { name: '枠を閉じる' })
    ).toBeInTheDocument();
  });

  it('hides 枠を閉じる when status=closed', async () => {
    get.mockResolvedValueOnce({ data: { ...baseSlot, status: 'closed' } });
    get.mockResolvedValueOnce({ data: [] });
    render(<AdminLessonEditPage />);
    await screen.findByText('枠 #abc');
    expect(
      screen.queryByRole('button', { name: '枠を閉じる' })
    ).not.toBeInTheDocument();
  });

  it('calls update and navigates back on close', async () => {
    get.mockResolvedValueOnce({ data: baseSlot });
    get.mockResolvedValueOnce({ data: [] });
    adminUpdateSlot.mockResolvedValueOnce({});
    render(<AdminLessonEditPage />);
    fireEvent.click(await screen.findByRole('button', { name: '枠を閉じる' }));
    await waitFor(() =>
      expect(adminUpdateSlot).toHaveBeenCalledWith('abc', { status: 'closed' })
    );
    expect(push).toHaveBeenCalledWith('/admin/lessons');
  });
});
