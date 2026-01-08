import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";

// Admin client to bypass RLS for aggregate stats
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (!(await verifyUserPermissions(user.id, ["admin", "superadmin"])))
      return forbidden();
    const { count: totalTickets, error: countError } = await supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;

    // 2. Fetch tickets grouped by Status
    // Supabase JS doesn't support "GROUP BY" natively easily in one call for counts,
    // but for internal dashboard scale (hundreds/thousands), fetching partial CSV or using RPC is better.
    // For simplicity/MVP: Fetch all relevant columns and aggregate in memory (Node.js is fast enough for <10k records).

    const { data: tickets, error: dataError } = await supabaseAdmin
      .from("tickets")
      .select("id, status, category, created_at, updated_at, solution");

    if (dataError) throw dataError;

    // Aggregations
    const ticketsByStatus: Record<string, number> = {};
    const ticketsByCategory: Record<string, number> = {};
    let totalResolutionTimeMs = 0;
    let resolvedCount = 0;

    tickets.forEach((t) => {
      // Status Count
      ticketsByStatus[t.status] = (ticketsByStatus[t.status] || 0) + 1;

      // Category Count
      const cat = t.category || "Sin Categoría";
      ticketsByCategory[cat] = (ticketsByCategory[cat] || 0) + 1;

      // Resolution Time (only if RESOLVED/CERRADO and has dates)
      if (
        (t.status === "RESUELTO" || t.status === "CERRADO") &&
        t.created_at &&
        t.updated_at
      ) {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.updated_at).getTime();
        if (end > start) {
          totalResolutionTimeMs += end - start;
          resolvedCount++;
        }
      }
    });

    const avgResolutionHours =
      resolvedCount > 0
        ? (totalResolutionTimeMs / resolvedCount / (1000 * 60 * 60)).toFixed(1)
        : 0;

    return NextResponse.json({
      total: totalTickets,
      byStatus: ticketsByStatus,
      byCategory: ticketsByCategory,
      avgResolutionHours: Number(avgResolutionHours),
      ticketsProcessed: tickets.length,
    });
  } catch (error) {
    console.error("Error generating metrics:", error);
    return NextResponse.json(
      { error: "Error interno calculando métricas" },
      { status: 500 },
    );
  }
}
