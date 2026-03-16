import { useGetActivePlan } from "@workspace/api-client-react";

export function usePlan() {
  const { data: plan, isLoading, error } = useGetActivePlan({
    query: {
      retry: false,
    }
  });

  return {
    plan,
    isLoading,
    error
  };
}
