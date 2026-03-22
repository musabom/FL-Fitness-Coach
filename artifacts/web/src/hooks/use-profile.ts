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
import { useCoachClient } from "@/context/coach-client-context";

const AUTH_KEY = ["auth", "me"];

export function useProfile() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { clientId } = useCoachClient();

  const profileQuery = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(clientId ? { clientId } : undefined),
      retry: false,
    },
    params: clientId ? { clientId } : undefined,
  });

  const updateProfileMutation = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey(clientId ? { clientId } : undefined) });
        queryClient.invalidateQueries({ queryKey: getGetActivePlanQueryKey(clientId ? { clientId } : undefined) });
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
