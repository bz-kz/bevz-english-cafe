import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AdminUserPicker } from '../AdminUserPicker';
import * as lib from '@/lib/admin-booking';

jest.mock('@/lib/firebase', () => ({
  firebaseAuth: { currentUser: { getIdToken: () => Promise.resolve('t') } },
}));
jest.mock('@/lib/admin-booking');

const mocked = lib as jest.Mocked<typeof lib>;

describe('AdminUserPicker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mocked.searchAdminUsers.mockResolvedValue([
      { uid: 'u1', email: 'taro@example.com', name: '山田太郎' },
      { uid: 'u2', email: 'hanako@example.com', name: '佐藤花子' },
    ]);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('calls searchAdminUsers after 300ms debounce', async () => {
    const onSelect = jest.fn();
    render(<AdminUserPicker onSelect={onSelect} />);
    const input = screen.getByPlaceholderText(/メール.*名前.*検索/);
    fireEvent.change(input, { target: { value: 'taro' } });
    expect(mocked.searchAdminUsers).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(mocked.searchAdminUsers).toHaveBeenCalledWith('taro');
    });
  });

  it('shows candidates after fetch', async () => {
    const onSelect = jest.fn();
    render(<AdminUserPicker onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/メール.*名前.*検索/), {
      target: { value: 'a' },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await screen.findByText(/taro@example.com/);
    expect(screen.getByText(/hanako@example.com/)).toBeInTheDocument();
  });

  it('invokes onSelect when a candidate is clicked', async () => {
    const onSelect = jest.fn();
    render(<AdminUserPicker onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/メール.*名前.*検索/), {
      target: { value: 'a' },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const candidate = await screen.findByText(/taro@example.com/);
    fireEvent.click(candidate);
    expect(onSelect).toHaveBeenCalledWith({
      uid: 'u1',
      email: 'taro@example.com',
      name: '山田太郎',
    });
  });
});
