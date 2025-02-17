
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      // If not loading and no user, redirect to auth
      if (!user) {
        navigate('/auth');
      } else if (user && profile && !profile.is_onboarded && location.pathname !== '/onboarding') {
        navigate('/onboarding');
      }
    }
  }, [user, profile, loading, navigate, location.pathname]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  // Only render children if we have a user
  return user ? <>{children}</> : null;
};
