import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";
import { sanitizePostgrestSearch } from "@/lib/security";
import Logger from "@/lib/logger";

async function searchAssetsHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get("q") || "";
  const query = sanitizePostgrestSearch(rawQuery, 50);

  if (!query || query.length < 3) {
    return NextResponse.json({ data: [] });
  }

  // Use the authenticated supabase client from context (enforces RLS)
  const { data, error } = await ctx.supabase
    .from("assets")
    .select("id, serial_number, type, brand, model, location")
    .ilike("serial_number", `%${query}%`)
    .limit(10);

  if (error) {
    Logger.error("Error searching assets", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}

export const GET = withAuth(searchAssetsHandler);
