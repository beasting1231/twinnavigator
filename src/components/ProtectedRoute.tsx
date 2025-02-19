
import React from 'react';
import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading, error } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showLoading, setShowLoading] = React.useState(false);

  // Only show loading spinner after a delay to prevent flash
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setShowLoading(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please try logging in again",
      });
      navigate('/auth');
    }
  }, [error, navigate, toast]);

  // Handle redirect logic when auth state changes
  useEffect(() => {
    if (!loading && !user && location.pathname !== '/auth') {
      console.log('ProtectedRoute: No user found, redirecting to auth');
      navigate('/auth', { replace: true });
    } else if (!loading && user && profile && !profile.is_onboarded && location.pathname !== '/onboarding') {
      console.log('ProtectedRoute: User not onboarded, redirecting to onboarding');
      navigate('/onboarding', { replace: true });
    }
  }, [user, profile, loading, location.pathname, navigate]);

  // Show loading state
  if (showLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-lg font-medium">Loading...</p>
      </div>
    );
  }

  // If we're not logged in and trying to access a protected route, redirect to auth
  if (!loading && !user && location.pathname !== '/auth') {
    console.log('ProtectedRoute: Redirecting to auth page');
    return <Navigate to="/auth" replace />;
  }

  // If we're logged in but not onboarded and not on the onboarding page, redirect to onboarding
  if (!loading && user && profile && !profile.is_onboarded && location.pathname !== '/onboarding') {
    console.log('ProtectedRoute: Redirecting to onboarding');
    return <Navigate to="/onboarding" replace />;
  }

  // Render children if all conditions are met
  return <>{children}</>;
};
