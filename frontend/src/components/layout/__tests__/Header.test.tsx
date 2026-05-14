import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../Header';

const signOutMock = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { displayName: 'テスト太郎', email: 't@example.com' },
    isAdmin: false,
    signOut: signOutMock,
  }),
}));

describe('Header dropdown', () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it('starts closed', () => {
    render(<Header />);
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
  });

  it('opens when the user button is clicked', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    expect(screen.getByText('マイページ')).toBeInTheDocument();
  });

  it('closes when an outside click occurs', () => {
    render(
      <div>
        <Header />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    expect(screen.getByText('マイページ')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
  });

  it('closes when the マイページ link is clicked', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    fireEvent.click(screen.getByText('マイページ'));
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
  });

  it('closes when Escape is pressed', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    expect(screen.getByText('マイページ')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
  });

  it('closes and calls signOut when ログアウト is clicked', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    fireEvent.click(screen.getByText('ログアウト'));
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
  });
});
