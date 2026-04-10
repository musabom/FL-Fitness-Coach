import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetActivePlanQueryKey,
  getGetProfileQueryKey,
  customFetch,
  ApiError,
} from "@workspace/api-client-react";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string | null;
  role: "member" | "coach" | "admin";
  hasProfile: boolean;
  coachId: number | null;
  coachName: string | null;
  coachUpdatedAt: string | null;
  subscriptionStartedAt: string | null;
  subscriptionDaysLeft: number | null;
}

const AUTH_KEY = ["auth", "me"];

const AUTO_LOGIN_ENABLED = false;
const AUTO_LOGIN_EMAIL = "";
const AUTO_LOGIN_PASSWORD = "";
let autoLoginAttempted = false;

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: AUTH_KEY,
    queryFn: async () => {
      try {
        return await customFetch<AuthUser>("/api/auth/me");
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          // 403 means account deactivated — treat as unauthenticated
          if (e.status === 403) return null;

          // Auto-login if enabled and not already attempted
          if (AUTO_LOGIN_ENABLED && !autoLoginAttempted) {
            autoLoginAttempted = true;
            try {
              const loginResult = await customFetch<AuthUser>("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                  email: AUTO_LOGIN_EMAIL,
                  password: AUTO_LOGIN_PASSWORD,
                }),
                headers: { "Content-Type": "application/json" },
              });
              return loginResult;
            } catch (loginError) {
              console.warn("Auto-login failed:", loginError);
              return null;
            }
          }
          return null;
        }
        throw e;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes — allows re-fetch after onboarding completes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      return customFetch<AuthUser>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data) => {
      autoLoginAttempted = true;
      queryClient.setQueryData(AUTH_KEY, data);
      queryClient.invalidateQueries({ queryKey: getGetActivePlanQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });

      // If user was trying to subscribe to a coach before login, send them back there
      const pendingId = localStorage.getItem("pendingSubscriptionServiceId");
      if (pendingId && data.role === "member") {
        if (data.hasProfile) {
          // Has profile → go straight to the service page to complete the subscribe
          setLocation(`/coaches/service/${pendingId}`);
        }
        // No profile → AuthGuard sends to /onboarding; pendingId stays in localStorage
        // and use-profile.ts will redirect to the service after onboarding completes
      } else if (pendingId && (data.role === "coach" || data.role === "admin")) {
        // Coaches/admins don't subscribe — clear the pending subscription
        localStorage.removeItem("pendingSubscriptionServiceId");
      }
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; passwordConfirm: string; firstName: string; lastName: string; inviteToken?: string }) => {
      return customFetch<AuthUser>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_KEY, data);
      setLocation("/onboarding");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return customFetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_KEY, null);
      queryClient.clear();
      setLocation("/coaches");
    },
  });

  return {
    user: user ?? undefined,
    isLoading,
    login: loginMutation,
    signup: signupMutation,
    logout: logoutMutation,
  };
}
