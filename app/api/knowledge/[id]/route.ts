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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const isStaff = await verifyUserPermissions(user.id, [
      "agent",
      "admin",
      "superadmin",
    ]);
    if (!isStaff) return forbidden("Acceso restringido");

    const { data, error } = await supabaseAdmin
      .from("knowledge_articles")
      .select(
        "*, created_by_user:users!knowledge_articles_created_by_fkey(full_name)",
      )
      .eq("id", params.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Artículo no encontrado" },
          { status: 404 },
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error fetching article detail:", error);
    return NextResponse.json(
      { error: "Error al obtener el detalle del artículo", details: message },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const isStaff = await verifyUserPermissions(user.id, [
      "agent",
      "admin",
      "superadmin",
    ]);
    if (!isStaff) return forbidden("No tienes permisos para editar");

    const body = await req.json();
    const { title, category, problem_type, solution, file_urls } = body;

    const { data, error } = await supabaseAdmin
      .from("knowledge_articles")
      .update({
        title,
        category,
        problem_type,
        solution,
        file_urls,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Error al actualizar el artículo", details: message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const isStaff = await verifyUserPermissions(user.id, [
      "agent",
      "admin",
      "superadmin",
    ]);
    if (!isStaff) return forbidden("No tienes permisos para eliminar");

    const { error } = await supabaseAdmin
      .from("knowledge_articles")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Error al eliminar el artículo", details: message },
      { status: 500 },
    );
  }
}
