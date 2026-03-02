import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const AUTH_STORAGE_KEY = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`;

const isFailedFetchError = (value: unknown): boolean => {
  if (!(value instanceof Error)) return false;
  return value.message.toLowerCase().includes('failed to fetch');
};

const clearCorruptedStoredSession = () => {
  const authKeys = Object.keys(localStorage).filter(
    (key) => key === AUTH_STORAGE_KEY || (key.startsWith('sb-') && key.endsWith('-auth-token')),
  );

  authKeys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      // Supabase v2 stores refresh_token at the top level
      const refreshToken = parsed?.refresh_token ?? parsed?.currentSession?.refresh_token;

      if (typeof refreshToken !== 'string' || refreshToken.length < 20) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  });
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer admin check to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            checkAdminStatus(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (isFailedFetchError(error)) {
        clearCorruptedStoredSession();
        await supabase.auth.signOut({ scope: 'local' });
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'super_admin']);

      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setIsSuperAdmin(false);
      } else {
        setIsAdmin(data && data.length > 0);
        setIsSuperAdmin(data?.some(r => r.role === 'super_admin') ?? false);
      }
    } catch (err) {
      console.error('Error checking admin status:', err);
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const attemptSignIn = () =>
      supabase.auth.signInWithPassword({
        email,
        password,
      });

    try {
      let { error } = await attemptSignIn();

      // One retry after clearing potentially corrupted local session token
      if (isFailedFetchError(error)) {
        clearCorruptedStoredSession();
        await supabase.auth.signOut({ scope: 'local' });
        ({ error } = await attemptSignIn());
      }

      return { error };
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error('Network error during sign in.');
      return { error: normalizedError };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    isAdmin,
    isSuperAdmin,
    loading,
    signIn,
    signUp,
    signOut,
  };
}

