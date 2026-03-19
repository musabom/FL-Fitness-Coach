import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useCoachClient } from "@/context/coach-client-context";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

export function usePlan() {
  const { clientId } = useCoachClient();

  const url = clientId
    ? `${BASE}/plan/active?clientId=${clientId}`
    : `${BASE}/plan/active`;

  const { data: plan, isLoading, error } = useQuery({
    queryKey: ["plan", "active", clientId ?? "self"],
    queryFn: () => customFetch<any>(url),
    retry: false,
  });

  return {
    plan,
    isLoading,
    error,
  };
}
