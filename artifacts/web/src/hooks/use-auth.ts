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
    staleTime: Infinity,
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
