import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Ticket } from "@/app/admin/admin.types";

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
          "id, ticket_code, category, ticket_type, description, location, status, is_vip_ticket, asset_serial, user_id, assigned_agent_id, sla_status, sla_start_at, sla_expected_end_at, sla_last_paused_at, sla_pause_reason, sla_clock_stopped_at, sla_total_paused_duration, hold_reason, solution, created_at, updated_at, users:users!tickets_user_id_fkey(full_name, area, is_vip), assigned_agent:users!tickets_assigned_agent_id_fkey(full_name)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      // Apply filter if status is not 'ALL' or empty
      if (status && status !== "ALL") {
        if (status === "VIP") {
          query = query.eq("is_vip_ticket", true);
        } else {
          query = query.eq("status", status);
        }
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
