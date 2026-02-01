import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
  fetchAuthSession: vi.fn(),
}));

import { signIn as amplifySignIn, signOut as amplifySignOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedFetchAuthSession = vi.mocked(fetchAuthSession);
const mockedSignIn = vi.mocked(amplifySignIn);
const mockedSignOut = vi.mocked(amplifySignOut);

function TestConsumer() {
  const { user, isAuthenticated, isLoading, signIn, signOut } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="user">{user ? user.email ?? user.username : 'none'}</div>
      <button onClick={() => signIn('test@example.com', 'password123')}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}

function TestConsumerWithErrorCapture() {
  const { user, isAuthenticated, isLoading, signIn, signOut } = useAuth();
  const [error, setError] = useState('');
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="user">{user ? user.email ?? user.username : 'none'}</div>
      <div data-testid="error">{error}</div>
      <button onClick={() => signIn('test@example.com', 'password123').catch((e) => setError(e.message))}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state and resolves to unauthenticated when no user', async () => {
    mockedGetCurrentUser.mockRejectedValue(new Error('not authenticated'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('resolves to authenticated when user exists', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      username: 'testuser',
      userId: '123',
    });
    mockedFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: { payload: { email: 'test@example.com' } },
      },
    } as never);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  it('signIn updates state on success', async () => {
    mockedGetCurrentUser.mockRejectedValueOnce(new Error('not authenticated'));
    mockedSignIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    mockedGetCurrentUser.mockResolvedValue({ username: 'testuser', userId: '123' });
    mockedFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: { payload: { email: 'test@example.com' } },
      },
    } as never);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(mockedSignIn).toHaveBeenCalledWith({ username: 'test@example.com', password: 'password123' });
  });

  it('signIn throws when isSignedIn is false', async () => {
    mockedGetCurrentUser.mockRejectedValue(new Error('not authenticated'));
    mockedSignIn.mockResolvedValue({ isSignedIn: false, nextStep: { signInStep: 'CONFIRM_SIGN_UP' } });

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumerWithErrorCapture />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Sign-in was not completed');
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('signOut clears user state', async () => {
    mockedGetCurrentUser.mockResolvedValue({ username: 'testuser', userId: '123' });
    mockedFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: { payload: { email: 'test@example.com' } },
      },
    } as never);
    mockedSignOut.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    await user.click(screen.getByText('Sign Out'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('throws if useAuth is used outside AuthProvider', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });
});
