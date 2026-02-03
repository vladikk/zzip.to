import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const mockSignIn = vi.fn();
const mockConfirmNewPassword = vi.fn();
let mockNeedsNewPassword = false;

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    confirmNewPassword: mockConfirmNewPassword,
    isAuthenticated: false,
    isLoading: false,
    needsNewPassword: mockNeedsNewPassword,
    user: null,
    signOut: vi.fn(),
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNeedsNewPassword = false;
  });

  it('renders login form with email and password fields', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText('zzip.to Admin')).toBeInTheDocument();
  });

  it('handles successful form submission', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('admin@example.com', 'secret123');
    });
  });

  it('displays error message on sign-in failure', async () => {
    mockSignIn.mockRejectedValue(new Error('Incorrect username or password'));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Incorrect username or password');
    });
  });

  it('shows loading state during submission', async () => {
    let resolveSignIn: () => void;
    mockSignIn.mockReturnValue(new Promise<void>((resolve) => { resolveSignIn = resolve; }));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();

    resolveSignIn!();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign In' })).not.toBeDisabled();
    });
  });

  it('disables inputs during submission', async () => {
    let resolveSignIn: () => void;
    mockSignIn.mockReturnValue(new Promise<void>((resolve) => { resolveSignIn = resolve; }));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();

    resolveSignIn!();
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).not.toBeDisabled();
    });
  });

  it('shows new password form when needsNewPassword is true', () => {
    mockNeedsNewPassword = true;

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Set New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Password' })).toBeInTheDocument();
  });

  it('calls confirmNewPassword on new password form submission', async () => {
    mockNeedsNewPassword = true;
    mockConfirmNewPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('New Password'), 'myNewPassword123');
    await user.click(screen.getByRole('button', { name: 'Set Password' }));

    await waitFor(() => {
      expect(mockConfirmNewPassword).toHaveBeenCalledWith('myNewPassword123');
    });
  });
});
