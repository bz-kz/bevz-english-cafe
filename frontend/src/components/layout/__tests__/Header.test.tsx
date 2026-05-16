import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../Header';

const signOutMock = jest.fn();

const authState = {
  user: { displayName: 'テスト太郎', email: 't@example.com' } as {
    displayName: string;
    email: string;
  } | null,
  isAdmin: false,
  loading: false,
  signOut: signOutMock,
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => authState,
}));

describe('Header dropdown', () => {
  beforeEach(() => {
    signOutMock.mockReset();
    authState.user = { displayName: 'テスト太郎', email: 't@example.com' };
    authState.isAdmin = false;
    authState.loading = false;
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

  it('renders a non-link Admin placeholder while auth is loading', () => {
    authState.loading = true;
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Admin' })
    ).not.toBeInTheDocument();
  });

  it('renders the Admin link when resolved and isAdmin', () => {
    authState.loading = false;
    authState.isAdmin = true;
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin/lessons'
    );
  });

  it('renders no Admin entry when resolved and not admin', () => {
    authState.loading = false;
    authState.isAdmin = false;
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Admin' })
    ).not.toBeInTheDocument();
  });
});
