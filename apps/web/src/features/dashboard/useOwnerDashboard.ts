import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchOwnerDashboard } from "../../lib/api";

export function useOwnerDashboard() {
  return useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: fetchOwnerDashboard,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}
