import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { forbidden, verifyUserPermissions } from "@/lib/auth-check";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";
import { calculateBusinessMinutesBetween } from "@/lib/domain/sla-calculator";

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

    // 2. Fetch total count (Lightweight metadata query)
    const { count: totalTickets, error: countError } = await supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;

    // 3. Fetch status and category distribution (Only querying specific fields)
    const { data: ticketsData, error: dataError } = await supabaseAdmin
      .from("tickets")
      .select("status, category");

    if (dataError) throw dataError;

    // 4. Fetch only resolved/closed tickets timestamps to calculate business resolution time
    const { data: resolvedTickets, error: resolvedError } = await supabaseAdmin
      .from("tickets")
      .select("created_at, updated_at")
      .in("status", ["RESUELTO", "CERRADO"])
      .not("created_at", "is", null)
      .not("updated_at", "is", null);

    if (resolvedError) throw resolvedError;

    // Aggregations
    const ticketsByStatus: Record<string, number> = {};
    const ticketsByCategory: Record<string, number> = {};

    ticketsData.forEach((t) => {
      // Status Count
      ticketsByStatus[t.status] = (ticketsByStatus[t.status] || 0) + 1;

      // Category Count
      const cat = t.category || "Sin Categoría";
      ticketsByCategory[cat] = (ticketsByCategory[cat] || 0) + 1;
    });

    let totalResolutionMinutes = 0;
    let resolvedCount = 0;

    resolvedTickets.forEach((t) => {
      if (t.created_at && t.updated_at) {
        // Calculate only business minutes transcurred (excluding nights, weekends and Colombian holidays)
        const businessMinutes = calculateBusinessMinutesBetween(
          t.created_at,
          t.updated_at,
        );
        totalResolutionMinutes += businessMinutes;
        resolvedCount++;
      }
    });

    const avgResolutionHours =
      resolvedCount > 0
        ? (totalResolutionMinutes / 60 / resolvedCount).toFixed(1)
        : 0;

    return NextResponse.json({
      total: totalTickets,
      byStatus: ticketsByStatus,
      byCategory: ticketsByCategory,
      avgResolutionHours: Number(avgResolutionHours),
      ticketsProcessed: ticketsData.length,
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
