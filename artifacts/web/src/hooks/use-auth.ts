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
  fullName: string | null;
  role: string;
  hasProfile: boolean;
}

const AUTH_KEY = ["auth", "me"];

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
      queryClient.setQueryData(AUTH_KEY, data);
      queryClient.invalidateQueries({ queryKey: getGetActivePlanQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; passwordConfirm: string; fullName?: string }) => {
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
