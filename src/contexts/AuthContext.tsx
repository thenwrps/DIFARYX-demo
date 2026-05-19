import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';

export interface AuthUser {
  name: string;
  email: string;
  organization?: string;
  picture?: string;
  provider?: 'google' | 'email' | 'guest';
}

export type AuthStatus =
  | 'initializing'
  | 'authenticated'
  | 'guest'
  | 'unauthenticated'
  | 'error';

interface AuthContextType {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'demoAuth';
const PROFILE_KEY = 'demoProfile';
const LEGACY_GOOGLE_AUTH_KEY = 'difaryx_google_demo_user';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
}

function authDebug(message: string, details?: unknown) {
  if (!import.meta.env.DEV) return;
  if (details === undefined) {
    console.info(message);
    return;
  }
  console.info(message, details);
}

function getStatusForUser(user: AuthUser | null): AuthStatus {
  if (!user) return 'unauthenticated';
  return user.provider === 'google' ? 'authenticated' : 'guest';
}

function normalizeStoredUser(user: Partial<AuthUser>): AuthUser | null {
  if (!user.email || !user.name) return null;

  return {
    name: user.name,
    email: user.email,
    organization: user.organization,
    picture: user.picture,
    provider: user.provider ?? 'guest',
  };
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

function restoreStoredAuthState(): AuthState {
  authDebug('[auth] provider init start');

  if (typeof window === 'undefined') {
    return { status: 'initializing', user: null, error: null };
  }

  try {
    const authStatus = localStorage.getItem(AUTH_KEY);
    const profileData = localStorage.getItem(PROFILE_KEY);

    if (authStatus === 'true' && profileData) {
      const user = normalizeStoredUser(JSON.parse(profileData) as Partial<AuthUser>);

      if (!user) {
        clearStoredAuth();
        authDebug('[auth] restored local session: false');
        authDebug('[auth] provider user found: false');
        return {
          status: 'unauthenticated',
          user: null,
          error: null,
        };
      }

      const status = getStatusForUser(user);
      authDebug('[auth] restored local session: true');
      authDebug('[auth] provider user found:', status === 'authenticated');
      return { status, user, error: null };
    }

    const legacyGoogleProfile = localStorage.getItem(LEGACY_GOOGLE_AUTH_KEY);
    if (legacyGoogleProfile) {
      const legacyUser = JSON.parse(legacyGoogleProfile) as Partial<AuthUser>;
      const user = normalizeStoredUser({
        ...legacyUser,
        provider: 'google',
      });

      if (user) {
        localStorage.setItem(AUTH_KEY, 'true');
        localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
        authDebug('[auth] restored local session: true');
        authDebug('[auth] provider user found: true');
        return { status: 'authenticated', user, error: null };
      }
    }

    authDebug('[auth] restored local session: false');
    authDebug('[auth] provider user found: false');
    return { status: 'unauthenticated', user: null, error: null };
  } catch (error) {
    clearStoredAuth();
    localStorage.removeItem(LEGACY_GOOGLE_AUTH_KEY);
    const message = error instanceof Error ? error.message : 'Unable to restore auth session';
    authDebug('[auth] restored local session: false');
    authDebug('[auth] provider user found: false');
    return { status: 'error', user: null, error: message };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => restoreStoredAuthState());

  useEffect(() => {
    if (authState.status === 'initializing' && typeof window !== 'undefined') {
      setAuthState(restoreStoredAuthState());
    }
  }, [authState.status]);

  useEffect(() => {
    authDebug(`[auth] status changed: ${authState.status}`);
  }, [authState.status]);

  const signIn = useCallback((newUser: AuthUser) => {
    try {
      const normalizedUser = normalizeStoredUser(newUser);
      if (!normalizedUser) throw new Error('Auth profile is missing required fields');

      localStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizedUser));
      setAuthState({
        status: getStatusForUser(normalizedUser),
        user: normalizedUser,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save auth session';
      setAuthState({ status: 'error', user: null, error: message });
    }
  }, []);

  const signOut = useCallback(() => {
    clearStoredAuth();
    setAuthState({ status: 'unauthenticated', user: null, error: null });
  }, []);

  const value = useMemo(() => {
    const isAuthenticated =
      authState.status === 'authenticated' || authState.status === 'guest';

    return {
      status: authState.status,
      isAuthenticated,
      user: authState.user,
      isLoading: authState.status === 'initializing',
      error: authState.error,
      signIn,
      signOut,
    };
  }, [authState, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
