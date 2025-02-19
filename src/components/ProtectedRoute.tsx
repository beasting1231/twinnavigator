
import React from 'react';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isInitializing, setIsInitializing] = React.useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 2000); // Add a minimum loading time
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading) {
      console.log('ProtectedRoute - Auth state updated:', { user, profile, location: location.pathname });
      
      if (!user && location.pathname !== '/auth') {
        console.log('ProtectedRoute - Redirecting to auth page');
        navigate('/auth', { replace: true });
      } else if (user && profile && !profile.is_onboarded && location.pathname !== '/onboarding') {
        console.log('ProtectedRoute - Redirecting to onboarding');
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user, profile, loading, navigate, location.pathname]);

  // Show loading state
  if (loading || isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-lg font-medium">Loading...</p>
      </div>
    );
  }

  // Show error state if there's an authentication error
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <p className="text-lg text-destructive font-medium">Authentication error</p>
        <button 
          onClick={() => navigate('/auth')}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Return to login
        </button>
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
