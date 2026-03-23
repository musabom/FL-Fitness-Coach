import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  useCompleteOnboarding, 
  useGetAvailableGoals,
  getGetActivePlanQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useCoachClient } from "@/context/coach-client-context";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

function buildProfileUrl(clientId: number | null, path = "/profile") {
  const url = `${BASE}${path}`;
  return clientId ? `${url}?clientId=${clientId}` : url;
}

export function useProfile() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { clientId } = useCoachClient();

  const profileQuery = useQuery({
    queryKey: ["profile", clientId ?? "self"],
    queryFn: () => customFetch<any>(buildProfileUrl(clientId)),
    retry: false,
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ data, cId }: { data: any; cId: number | null }) =>
      customFetch(buildProfileUrl(cId), {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["profile", variables.cId ?? "self"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: getGetActivePlanQueryKey() });
    }
  });

  const completeOnboardingMutation = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        // If user came from a coach service page before signing up, send them back there
        const pendingId = localStorage.getItem("pendingSubscriptionServiceId");
        if (pendingId) {
          setLocation(`/coaches/service/${pendingId}`);
        } else {
          setLocation("/dashboard");
        }
      }
    }
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile: updateProfileMutation,
    clientId,
    completeOnboarding: completeOnboardingMutation,
    useGetAvailableGoals,
  };
}
