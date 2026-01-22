import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedContext } from "@/lib/api-middleware";

async function searchAssetsHandler(
  request: NextRequest,
  ctx: AuthenticatedContext,
) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.length < 3) {
    return NextResponse.json({ data: [] });
  }

  // Use the authenticated supabase client from context
  const { data, error } = await ctx.supabase
    .from("assets")
    .select("id, serial_number, type, brand, model, location")
    .ilike("serial_number", `%${query}%`)
    .limit(10);

  if (error) {
    console.error("Error searching assets:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}

export const GET = withAuth(searchAssetsHandler);
