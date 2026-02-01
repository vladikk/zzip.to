import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { signIn as amplifySignIn, signOut as amplifySignOut, confirmSignIn as amplifyConfirmSignIn, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

interface User {
  username: string;
  email?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsNewPassword: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  confirmNewPassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);

  useEffect(() => {
    checkCurrentUser();
  }, []);

  async function checkCurrentUser() {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const email = session.tokens?.idToken?.payload?.email as string | undefined;
      setUser({ username: currentUser.username, email });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  const signIn = useCallback(async (email: string, password: string) => {
    const { isSignedIn, nextStep } = await amplifySignIn({ username: email, password });
    if (nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      setNeedsNewPassword(true);
      return;
    }
    if (!isSignedIn) {
      throw new Error('Sign-in was not completed');
    }
    const currentUser = await getCurrentUser();
    const session = await fetchAuthSession();
    const userEmail = session.tokens?.idToken?.payload?.email as string | undefined;
    setUser({ username: currentUser.username, email: userEmail ?? email });
  }, []);

  const confirmNewPassword = useCallback(async (newPassword: string) => {
    const { isSignedIn } = await amplifyConfirmSignIn({ challengeResponse: newPassword });
    if (!isSignedIn) {
      throw new Error('Password change was not completed');
    }
    setNeedsNewPassword(false);
    const currentUser = await getCurrentUser();
    const session = await fetchAuthSession();
    const userEmail = session.tokens?.idToken?.payload?.email as string | undefined;
    setUser({ username: currentUser.username, email: userEmail });
  }, []);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, needsNewPassword, signIn, confirmNewPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
