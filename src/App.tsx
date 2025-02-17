
import { BrowserRouter as Router } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import TopBar from "@/components/TopBar";
import SideMenu from "@/components/SideMenu";
import { Routes, Route } from "react-router-dom";
import DailyPlan from "@/pages/DailyPlan";
import Availability from "@/pages/Availability";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <div className="min-h-screen">
            <TopBar />
            <div className="flex">
              <SideMenu />
              <main className="flex-1 p-8">
                <Routes>
                  <Route 
                    path="/" 
                    element={
                      <ProtectedRoute>
                        <DailyPlan />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/availability" 
                    element={
                      <ProtectedRoute>
                        <Availability />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/auth" element={<Auth />} />
                  <Route 
                    path="/onboarding" 
                    element={
                      <ProtectedRoute>
                        <Onboarding />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
            <Toaster />
          </div>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
