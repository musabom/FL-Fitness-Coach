import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  useCompleteOnboarding, 
  useGetAvailableGoals,
  getGetActivePlanQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useCoachClient, useClientUrl } from "@/context/coach-client-context";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

export function useProfile() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { clientId } = useCoachClient();
  const buildUrl = useClientUrl();

  const profileQuery = useQuery({
    queryKey: ["profile", clientId ?? "self"],
    queryFn: () => customFetch<any>(buildUrl(`${BASE}/profile`)),
    retry: false,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (variables: { data: any }) =>
      customFetch(buildUrl(`${BASE}/profile`), {
        method: "PUT",
        body: JSON.stringify(variables.data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: getGetActivePlanQueryKey() });
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
