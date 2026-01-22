import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";

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

async function metricsHandler(req: NextRequest, ctx: AuthenticatedContext) {
  try {
    // 1. Authorization check
    if (!(await verifyUserPermissions(ctx.user.id, ["admin", "superadmin"]))) {
      return forbidden("Only admins can access metrics");
    }

    // 2. Fetch total count
    const { count: totalTickets, error: countError } = await supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;

    // 3. Fetch tickets for aggregation
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

export const GET = withAuth(metricsHandler);
