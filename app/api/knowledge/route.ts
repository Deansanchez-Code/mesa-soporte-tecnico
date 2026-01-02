import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";

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

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    // Security check: Only staff can access knowledge base
    const isStaff = await verifyUserPermissions(user.id, [
      "agent",
      "admin",
      "superadmin",
    ]);
    if (!isStaff) return forbidden("Acceso restringido a personal de soporte");

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const problemType = searchParams.get("problem_type");
    const query = searchParams.get("q");

    let dbQuery = supabaseAdmin
      .from("knowledge_articles")
      .select(
        "*, created_by_user:users!knowledge_articles_created_by_fkey(full_name)",
      )
      .order("created_at", { ascending: false });

    if (category && category !== "Todos") {
      dbQuery = dbQuery.eq("category", category);
    }

    if (problemType) {
      dbQuery = dbQuery.ilike("problem_type", `%${problemType}%`);
    }

    if (query) {
      dbQuery = dbQuery.or(`title.ilike.%${query}%,solution.ilike.%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error fetching knowledge articles:", error);
    return NextResponse.json(
      { error: "Error al obtener artículos de conocimiento", details: message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const isStaff = await verifyUserPermissions(user.id, [
      "agent",
      "admin",
      "superadmin",
    ]);
    if (!isStaff) return forbidden("No tienes permisos para crear artículos");

    const body = await req.json();
    const { title, category, problem_type, solution, file_urls } = body;

    if (!title || !category || !problem_type || !solution) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("knowledge_articles")
      .insert([
        {
          title,
          category,
          problem_type,
          solution,
          file_urls: file_urls || [],
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error creating knowledge article:", error);
    return NextResponse.json(
      { error: "Error al crear el artículo", details: message },
      { status: 500 },
    );
  }
}
