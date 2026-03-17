import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetActivePlanQueryKey,
  getGetProfileQueryKey,
  customFetch,
  ApiError,
} from "@workspace/api-client-react";

interface AuthUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  hasProfile: boolean;
}

const AUTH_KEY = ["auth", "me"];

// DEVELOPMENT MODE: Auto-login disabled authentication
// Set to false to require manual login
const AUTO_LOGIN_ENABLED = true;
const AUTO_LOGIN_EMAIL = "test@example.com";
const AUTO_LOGIN_PASSWORD = "Password123";
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
        if (e instanceof ApiError && e.status === 401) {
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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; passwordConfirm: string; firstName?: string; lastName?: string }) => {
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
      setLocation("/login");
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
