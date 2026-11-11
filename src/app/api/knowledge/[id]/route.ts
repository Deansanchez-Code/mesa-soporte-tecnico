import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSafeStoragePathOrUrl, UUID_SCHEMA } from "@/lib/security";
import Logger from "@/lib/logger";

const KnowledgeUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  category: z.enum(["Hardware", "Software", "Otro"]).optional(),
  problem_type: z.string().trim().min(2).max(120).optional(),
  solution: z.string().trim().min(5).max(20000).optional(),
  file_urls: z
    .array(z.string().refine(isSafeStoragePathOrUrl, "URL de archivo inválida"))
    .max(10)
    .optional(),
});

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> },
) {
  const params = await segmentData.params;
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const isStaff = await verifyUserPermissions(user.id, [
      "agent",
      "admin",
      "superadmin",
    ]);
    if (!isStaff) return forbidden("Acceso restringido");

    const parsedId = UUID_SCHEMA.safeParse(params.id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("knowledge_articles")
      .select(
        "id, title, category, problem_type, solution, file_urls, created_by, created_at, updated_at, created_by_user:users!knowledge_articles_created_by_fkey(full_name)",
      )
      .eq("id", parsedId.data)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Artículo no encontrado" },
          { status: 404 },
        );
      }
      Logger.error("Supabase error in GET /api/knowledge/[id]", error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    Logger.error("Critical error in GET /api/knowledge/[id]", error);
    return NextResponse.json(
      { error: "Error al obtener el detalle del artículo" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> },
) {
  const params = await segmentData.params;
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const isStaff = await verifyUserPermissions(user.id, [
      "agent",
      "admin",
      "superadmin",
    ]);
    if (!isStaff) return forbidden("No tienes permisos para editar");

    const parsedId = UUID_SCHEMA.safeParse(params.id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const parsedBody = KnowledgeUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Datos de actualización inválidos" },
        { status: 400 },
      );
    }

    const { title, category, problem_type, solution, file_urls } =
      parsedBody.data;
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("knowledge_articles")
      .update({
        ...(title !== undefined ? { title } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(problem_type !== undefined ? { problem_type } : {}),
        ...(solution !== undefined ? { solution } : {}),
        ...(file_urls !== undefined ? { file_urls } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsedId.data)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    Logger.error("Error updating article", error);
    return NextResponse.json(
      { error: "Error al actualizar el artículo" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> },
) {
  const params = await segmentData.params;
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const isStaff = await verifyUserPermissions(user.id, [
      "agent",
      "admin",
      "superadmin",
    ]);
    if (!isStaff) return forbidden("No tienes permisos para eliminar");

    const parsedId = UUID_SCHEMA.safeParse(params.id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("knowledge_articles")
      .delete()
      .eq("id", parsedId.data);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    Logger.error("Error deleting article", error);
    return NextResponse.json(
      { error: "Error al eliminar el artículo" },
      { status: 500 },
    );
  }
}
