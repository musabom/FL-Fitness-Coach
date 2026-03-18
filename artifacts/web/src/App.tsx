import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { useAuth } from "./hooks/use-auth";
import { Loader2 } from "lucide-react";

// Pages
import Login from "./pages/login";
import Signup from "./pages/signup";
import Onboarding from "./pages/onboarding";
import Dashboard from "./pages/dashboard";
import ProfileEdit from "./pages/profile-edit";
import NutritionMeals from "./pages/nutrition-meals";
import MealPlan from "./pages/meal-plan";
import ShoppingList from "./pages/shopping-list";
import TrainingBuilder from "./pages/training-builder";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Suppress AbortError warnings (harmless cleanup when navigating away)
queryClient.setDefaultOptions({
  queries: {
    ...queryClient.getDefaultOptions().queries,
  },
});

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.name === 'AbortError' || 
        event.reason?.message?.includes('signal is aborted')) {
      event.preventDefault();
    }
  });
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    const isAuthRoute = location === "/login" || location === "/signup";

    if (!user && !isAuthRoute) {
      setLocation("/login");
    } else if (user && isAuthRoute) {
      setLocation("/dashboard");
    } else if (user && !user.hasProfile && location !== "/onboarding") {
      setLocation("/onboarding");
    } else if (user && user.hasProfile && location === "/onboarding") {
      setLocation("/dashboard");
    }
    // Redirect root to dashboard
    else if (user && user.hasProfile && location === "/") {
      setLocation("/dashboard");
    }

  }, [user, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Prevent rendering protected content while redirecting
  const isAuthRoute = location === "/login" || location === "/signup";
  if (!user && !isAuthRoute) return null;
  if (user && !user.hasProfile && location !== "/onboarding") return null;

  return <>{children}</>;
}

function Router() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/profile/edit" component={ProfileEdit} />
        <Route path="/nutrition/meals" component={NutritionMeals} />
        <Route path="/nutrition/meal-plan" component={MealPlan} />
        <Route path="/nutrition/shopping-list" component={ShoppingList} />
        <Route path="/training/builder" component={TrainingBuilder} />
        {/* Explicit root catch to fall back to AuthGuard logic */}
        <Route path="/">
          <div /> 
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
