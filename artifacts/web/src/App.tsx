import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { useAuth } from "./hooks/use-auth";
import { CoachClientProvider } from "./context/coach-client-context";
import { useClickTracker } from "./hooks/use-click-tracker";
import { Loader2 } from "lucide-react";

// Pages
import Login from "./pages/login";
import Signup from "./pages/signup";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import Onboarding from "./pages/onboarding";
import Dashboard from "./pages/dashboard";
import ProfileEdit from "./pages/profile-edit";
import NutritionMeals from "./pages/nutrition-meals";
import MealPlan from "./pages/meal-plan";
import ShoppingList from "./pages/shopping-list";
import TrainingBuilder from "./pages/training-builder";
import WorkoutPlan from "./pages/workout-plan";
import Progress from "./pages/progress";
import CoachClients from "./pages/coach-clients";
import AdminPanel from "./pages/admin-panel";
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

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (
      event.reason?.name === "AbortError" ||
      event.reason?.message?.includes("signal is aborted")
    ) {
      event.preventDefault();
    }
  });
}

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"];

function isPublicRoute(loc: string) {
  return PUBLIC_ROUTES.includes(loc) || loc.startsWith("/reset-password");
}

function ClickTracker() {
  useClickTracker();
  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isPublicRoute(location)) {
      setLocation("/login");
      return;
    }

    if (user && isPublicRoute(location)) {
      // Route to role-specific home
      if (user.role === "admin") {
        setLocation("/admin");
      } else if (user.role === "coach") {
        setLocation("/coach/clients");
      } else {
        setLocation("/dashboard");
      }
      return;
    }

    // Members must complete onboarding
    if (user && user.role === "member") {
      if (!user.hasProfile && location !== "/onboarding") {
        setLocation("/onboarding");
      } else if (user.hasProfile && location === "/onboarding") {
        setLocation("/dashboard");
      } else if (user.hasProfile && location === "/") {
        setLocation("/dashboard");
      }
    }

    // Coaches with no profile still need onboarding (they were members first)
    if (user && user.role === "coach") {
      if (!user.hasProfile && location !== "/onboarding") {
        setLocation("/onboarding");
      } else if (user.hasProfile && location === "/") {
        setLocation("/coach/clients");
      }
    }

    // Admins skip onboarding
    if (user && user.role === "admin" && location === "/") {
      setLocation("/admin");
    }
  }, [user, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user && !isPublicRoute(location)) return null;
  if (user && user.role === "member" && !user.hasProfile && location !== "/onboarding") return null;
  if (user && user.role === "coach" && !user.hasProfile && location !== "/onboarding") return null;

  return <>{children}</>;
}

function Router() {
  return (
    <>
    <ClickTracker />
    <AuthGuard>
      <Switch>
        {/* Public */}
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />

        {/* Onboarding */}
        <Route path="/onboarding" component={Onboarding} />

        {/* Admin */}
        <Route path="/admin" component={AdminPanel} />

        {/* Coach */}
        <Route path="/coach/clients" component={CoachClients} />

        {/* Member + Coach client view */}
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/profile/edit" component={ProfileEdit} />
        <Route path="/nutrition/meals" component={NutritionMeals} />
        <Route path="/nutrition/meal-plan" component={MealPlan} />
        <Route path="/nutrition/shopping-list" component={ShoppingList} />
        <Route path="/training/builder" component={TrainingBuilder} />
        <Route path="/training/plan" component={WorkoutPlan} />
        <Route path="/progress" component={Progress} />

        <Route path="/">
          <div />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CoachClientProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </CoachClientProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
