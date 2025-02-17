
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!user && location.pathname !== '/auth') {
        navigate('/auth', { replace: true });
      } else if (user && profile && !profile.is_onboarded && location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
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

  // If we're not logged in and on a protected route, don't render anything
  if (!user && location.pathname !== '/auth') {
    return null;
  }

  // Render children if we're either logged in or on the auth page
  return <>{children}</>;
};
