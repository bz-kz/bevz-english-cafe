import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SlotForm } from '../SlotForm';

jest.mock('@/lib/booking', () => ({
  adminCreateSlot: jest.fn(),
}));

const mockSuccess = jest.fn();
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    success: mockSuccess,
    error: jest.fn(),
  }),
}));

import { adminCreateSlot } from '@/lib/booking';

const adminCreateSlotMock = adminCreateSlot as jest.MockedFunction<
  typeof adminCreateSlot
>;

const fill = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('SlotForm', () => {
  beforeEach(() => {
    adminCreateSlotMock.mockReset();
    mockSuccess.mockReset();
  });

  it('shows error when end is before start', async () => {
    const onCreated = jest.fn();
    render(<SlotForm onCreated={onCreated} />);
    fill('開始', '2026-05-20T10:00');
    fill('終了', '2026-05-20T09:00');
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(await screen.findByText(/終了は開始より後/i)).toBeInTheDocument();
    expect(adminCreateSlotMock).not.toHaveBeenCalled();
  });

  it('calls adminCreateSlot and shows success toast on happy path', async () => {
    adminCreateSlotMock.mockResolvedValueOnce({} as never);
    const onCreated = jest.fn().mockResolvedValueOnce(undefined);
    render(<SlotForm onCreated={onCreated} />);
    fill('開始', '2026-05-20T10:00');
    fill('終了', '2026-05-20T10:30');
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    await waitFor(() => expect(adminCreateSlotMock).toHaveBeenCalledTimes(1));
    expect(mockSuccess).toHaveBeenCalledWith(
      expect.stringContaining('枠を追加しました')
    );
    expect(onCreated).toHaveBeenCalled();
  });

  it('still shows success toast even when refresh fails', async () => {
    adminCreateSlotMock.mockResolvedValueOnce({} as never);
    const onCreated = jest.fn().mockRejectedValueOnce(new Error('boom'));
    render(<SlotForm onCreated={onCreated} />);
    fill('開始', '2026-05-20T10:00');
    fill('終了', '2026-05-20T10:30');
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    await waitFor(() => expect(mockSuccess).toHaveBeenCalled());
    expect(screen.queryByText(/作成に失敗しました/)).not.toBeInTheDocument();
  });
});
