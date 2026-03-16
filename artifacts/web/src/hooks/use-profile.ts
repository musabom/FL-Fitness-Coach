import { 
  useGetProfile, 
  useUpdateProfile, 
  useCompleteOnboarding, 
  useGetAvailableGoals,
  getGetProfileQueryKey,
  getGetActivePlanQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

const AUTH_KEY = ["auth", "me"];

export function useProfile() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const profileQuery = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      retry: false,
    }
  });

  const updateProfileMutation = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetActivePlanQueryKey() });
      }
    }
  });

  const completeOnboardingMutation = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/dashboard");
      }
    }
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile: updateProfileMutation,
    completeOnboarding: completeOnboardingMutation,
    useGetAvailableGoals,
  };
}
