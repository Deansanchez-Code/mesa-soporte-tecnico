import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isSafeStoragePathOrUrl,
  sanitizePostgrestSearch,
} from "@/lib/security";
import Logger from "@/lib/logger";

const KnowledgeCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.enum(["Hardware", "Software", "Otro"]),
  problem_type: z.string().trim().min(2).max(120),
  solution: z.string().trim().min(5).max(20000),
  file_urls: z
    .array(z.string().refine(isSafeStoragePathOrUrl, "URL de archivo inválida"))
    .max(10)
    .optional(),
});

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

    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const problemType = sanitizePostgrestSearch(
      searchParams.get("problem_type") || "",
      80,
    );
    const query = sanitizePostgrestSearch(searchParams.get("q") || "", 80);

    let dbQuery = supabaseAdmin
      .from("knowledge_articles")
      .select(
        "id, title, category, problem_type, solution, file_urls, created_by, created_at, updated_at, created_by_user:users!knowledge_articles_created_by_fkey(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);

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

    if (error) {
      Logger.error("Supabase error in GET /api/knowledge", error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    Logger.error("Critical error in GET /api/knowledge", error);
    return NextResponse.json(
      { error: "Error al obtener artículos de conocimiento" },
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
    const parsed = KnowledgeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos del artículo inválidos" },
        { status: 400 },
      );
    }

    const { title, category, problem_type, solution, file_urls } = parsed.data;
    const supabaseAdmin = getSupabaseAdmin();

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
    Logger.error("Error creating knowledge article", error);
    return NextResponse.json(
      { error: "Error al crear el artículo" },
      { status: 500 },
    );
  }
}
