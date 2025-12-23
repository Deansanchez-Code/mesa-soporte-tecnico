import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.length < 3) {
    return NextResponse.json({ data: [] });
  }

  try {
    // SECURITY FIX: Use authenticated client instead of Service Role
    const supabase = await createClient();

    // Verify authentication first (optional, RLS handles it too, but saves DB call)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
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
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
