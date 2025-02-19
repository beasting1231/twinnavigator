
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Add timeout for loading state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (loading) {
      timeoutId = setTimeout(() => {
        setLoading(false);
        toast({
          variant: "destructive",
          title: "Request timeout",
          description: "The request took too long. Please try again.",
        });
      }, 10000); // 10 second timeout
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loading, toast]);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submission

    try {
      setLoading(true);
      console.log('Auth - Starting authentication process');

      if (!email || !password) {
        throw new Error("Please fill in all fields");
      }

      if (isLogin) {
        await signIn(email, password);
        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });
      } else {
        await signUp(email, password);
        toast({
          title: "Account created",
          description: "Please check your email to verify your account",
        });
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      toast({
        variant: "destructive",
        title: "Authentication error",
        description: error.message || "An error occurred during authentication",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 space-y-6 backdrop-blur-xl bg-background/80 border-2">
        <h1 className="text-2xl font-bold text-center">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username email"
              name="email"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              name="password"
              disabled={loading}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !email || !password}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isLogin ? "Signing in..." : "Creating account..."}
              </div>
            ) : (
              isLogin ? "Sign In" : "Sign Up"
            )}
          </Button>
        </form>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline"
            disabled={loading}
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
