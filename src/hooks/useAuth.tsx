
import { useEffect, useState, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/auth';
import { useToast } from '@/components/ui/use-toast';

const AUTH_TIMEOUT = 0; // No timeout
const PROFILE_FETCH_RETRIES = 2;
const DEBUG = process.env.NODE_ENV === 'development';

const logAuthState = (state: string, data?: any) => {
  if (DEBUG) {
    console.log(`[Auth] ${state}`, data);
  }
};

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const resetAuthState = () => {
    setUser(null);
    setProfile(null);
    setError(null);
    setLoading(false);
    setIsInitialized(true);
    logAuthState('Auth state reset');
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    logAuthState('Starting auth initialization', { loading, isInitialized, user: !!user });

    const initAuthProcess = async () => {
      if (!mounted) return;
      
      try {
        setError(null);
        setLoading(true);
        
        // Race against timeout
        const authPromise = async () => {
          const [sessionResult, userResult] = await Promise.all([
            supabase.auth.getSession(),
            supabase.auth.getUser()
          ]);
          
          if (!mounted) return;

          const session = sessionResult.data.session;
          const user = userResult.data.user;
          const error = sessionResult.error || userResult.error;

          if (error) throw error;

          if (session?.user || user) {
            const activeUser = session?.user || user;
            setUser(activeUser);
            
            // Retry profile fetch with backoff
            for (let i = 0; i < PROFILE_FETCH_RETRIES; i++) {
              try {
                await fetchProfile(activeUser.id);
                break;
              } catch (err) {
                if (i === PROFILE_FETCH_RETRIES - 1) throw err;
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
              }
            }
          } else {
            setUser(null);
            setProfile(null);
          }
        };

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Auth initialization timeout')), AUTH_TIMEOUT);
        });

        await Promise.race([authPromise(), timeoutPromise]);
      } catch (error) {
        logAuthState('Auth initialization error', error);
        if (mounted) {
          setError(error as Error);
          resetAuthState();
          navigate('/auth', { replace: true });
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
          logAuthState('Auth initialization complete', { hasUser: !!user });
        }
      }
    };

    initAuthProcess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Auth state changed:', { event, session: !!session });
      
      if (!mounted) {
        console.log('[AuthProvider] Component unmounted during auth state change');
        return;
      }
      
      try {
        console.log('[AuthProvider] Processing auth state change');
        setError(null);
        setLoading(true);
        
        if (session?.user) {
          console.log('[AuthProvider] User session found:', { userId: session.user.id, email: session.user.email });
          setUser(session.user);
          console.log('[AuthProvider] Fetching updated profile...');
          try {
            await fetchProfile(session.user.id);
          } catch (error) {
            console.error('[AuthProvider] Error fetching profile:', error);
            // Continue with auth even if profile fetch fails
            setProfile(null);
          }
        } else {
          console.log('[AuthProvider] No user session, clearing state');
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('[AuthProvider] Error during auth state change:', error);
      } finally {
        if (mounted) {
          console.log('[AuthProvider] Completing auth state change');
          setLoading(false);
        }
      }
    });

    return () => {
      console.log('[AuthProvider] Cleaning up auth subscriptions');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    try {
      logAuthState('Fetching profile', { userId });
      
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Add 5 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]) as {
        data: Profile | null;
        error: any;
      };
      const { data, error } = result;

      if (error) {
        logAuthState('Error fetching profile', error);
        throw error;
      }
      
      if (!data) {
        const noProfileError = new Error('No profile found');
        logAuthState('No profile found', { userId });
        throw noProfileError;
      }

      logAuthState('Profile fetched successfully', { profileId: data.id });
      setProfile(data);
      setError(null);
      return data;
    } catch (error) {
      logAuthState('Profile fetch failed', error);
      throw error;
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      logAuthState('Attempting sign in', { email });
      
      console.log('[Auth] Starting sign in process');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('[Auth] Sign in response received', { error });
      if (error) throw error;
      
      logAuthState('Sign in successful');
      navigate('/');
    } catch (error: any) {
      logAuthState('Sign in error', error);
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('[AuthProvider] Initiating sign out process');
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      console.log('[AuthProvider] Sign out successful, clearing state');
      setUser(null);
      setProfile(null);
      setError(null);
      
      console.log('[AuthProvider] Redirecting to auth page');
      navigate('/auth', { replace: true });
    } catch (error: any) {
      console.error('[AuthProvider] Sign out error:', error);
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('[AuthProvider] Attempting sign up for:', email);
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      
      console.log('[AuthProvider] Sign up successful');
      toast({
        title: "Account created",
        description: "Please check your email to verify your account",
      });
    } catch (error: any) {
      console.error('[AuthProvider] Sign up error:', error);
      toast({
        variant: "destructive",
        title: "Error signing up",
        description: error.message,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    try {
      if (!user?.id) throw new Error('No user');

      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...data } : null);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating profile",
        description: error.message,
      });
      throw error;
    }
  };

  // Don't render until auth is initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
