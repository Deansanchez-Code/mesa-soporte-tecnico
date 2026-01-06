import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/cliente";
import { Ticket } from "@/app/admin/types";

interface UseTicketsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

interface TicketsResponse {
  data: Ticket[];
  count: number;
}

export const useTicketsQuery = ({
  page = 1,
  pageSize = 10,
  status,
}: UseTicketsOptions = {}) => {
  return useQuery<TicketsResponse>({
    queryKey: ["tickets", page, pageSize, status],
    queryFn: async () => {
      // Calculate range
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Base query
      let query = supabase
        .from("tickets")
        .select(
          "*, users:users!tickets_user_id_fkey(full_name), assigned_agent:users!tickets_assigned_agent_id_fkey(full_name)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      // Apply filter if status is not 'ALL' or empty
      if (status && status !== "ALL") {
        query = query.eq("status", status);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return {
        data: (data as unknown as Ticket[]) || [],
        count: count || 0,
      };
    },
    placeholderData: keepPreviousData, // Keep previous data while fetching new page for smooth UX
  });
};
