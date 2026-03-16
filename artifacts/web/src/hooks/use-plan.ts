import { useGetActivePlan, getGetActivePlanQueryKey } from "@workspace/api-client-react";

export function usePlan() {
  const { data: plan, isLoading, error } = useGetActivePlan({
    query: {
      queryKey: getGetActivePlanQueryKey(),
      retry: false,
    }
  });

  return {
    plan,
    isLoading,
    error
  };
}
