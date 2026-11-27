"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isDbPrivilegedUser } from "../rules/reservationHelpers";
import { resolveAuthenticatedPublicUser } from "../services/reservationAuthServer";

export interface AssignableUser {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  role: string | null;
  job_category: string | null;
  employment_type: string | null;
  area: string | null;
  is_vip?: boolean | null;
}

/**
 * Retorna la lista de instructores y funcionarios activos para que un coordinador o administrador
 * pueda asignar una reserva a su nombre.
 */
export async function getAssignableUsersAction(accessToken?: string): Promise<{
  success: boolean;
  users: AssignableUser[];
}> {
  try {
    const caller = await resolveAuthenticatedPublicUser(accessToken);
    if (!caller || !isDbPrivilegedUser(caller)) {
      return { success: false, users: [] };
    }

    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
      .from("users")
      .select(
        "id, full_name, username, email, role, job_category, employment_type, area, is_vip",
      )
      .or("is_active.eq.true,is_active.is.null")
      .order("full_name", { ascending: true });

    if (error || !data) {
      console.error("Error querying assignable users:", error);
      return { success: false, users: [] };
    }
    return { success: true, users: data as AssignableUser[] };
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return { success: false, users: [] };
  }
}

export async function updateInstructorAssignmentAction(params: {
  id: number;
  instructor_id: string;
  assignment_date: string;
  time_block: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    const { data: publicUser } = await supabase
      .from("users")
      .select(
        "id, role, job_category, username, is_vip, perm_manage_assignments",
      )
      .eq("auth_id", authUser.id)
      .single();

    const canManage = isDbPrivilegedUser(publicUser);

    if (!canManage) {
      throw new Error(
        "No tienes permisos para editar o reasignar asignaciones",
      );
    }

    const adminSupabase = getSupabaseAdmin();

    const { data: currentAssign, error: fetchErr } = await adminSupabase
      .from("instructor_assignments")
      .select("area_id")
      .eq("id", params.id)
      .single();

    if (fetchErr || !currentAssign) {
      throw new Error("Asignación no encontrada");
    }

    const { data: conflict } = await adminSupabase
      .from("instructor_assignments")
      .select("id")
      .eq("area_id", currentAssign.area_id)
      .eq("assignment_date", params.assignment_date)
      .eq("time_block", params.time_block)
      .neq("id", params.id)
      .maybeSingle();

    if (conflict) {
      throw new Error(
        "Ya existe otra asignación en este mismo ambiente, fecha y bloque horario.",
      );
    }

    const { error: updateErr } = await adminSupabase
      .from("instructor_assignments")
      .update({
        instructor_id: params.instructor_id,
        assignment_date: params.assignment_date,
        time_block: params.time_block,
      })
      .eq("id", params.id);

    if (updateErr) throw updateErr;

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error al actualizar la asignación",
    };
  }
}

export async function deleteInstructorAssignmentAction(assignmentId: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No autenticado");

    const { data: publicUser } = await supabase
      .from("users")
      .select(
        "id, role, job_category, username, is_vip, perm_manage_assignments",
      )
      .eq("auth_id", authUser.id)
      .single();

    const canManage = isDbPrivilegedUser(publicUser);

    if (!canManage) {
      throw new Error("No tienes permisos para eliminar asignaciones");
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
      .from("instructor_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === "23P01") {
        throw new Error(
          "El horario seleccionado acaba de ser reservado por otro usuario. Actualiza e intenta otra franja.",
        );
      }
      throw error;
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error ? err.message : "Error al eliminar la asignación",
    };
  }
}

export async function syncReservationTicketAction(params: {
  oldTitle: string;
  previousUserId?: string;
  newUserId: string;
  fullNewDescription: string;
  isoStart: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return { success: false };

    const adminSupabase = getSupabaseAdmin();
    const oldDescSubstring = `: ${params.oldTitle}`;

    let query = adminSupabase
      .from("tickets")
      .select("id, status, sla_status, user_id")
      .eq("category", "Reserva Auditorio")
      .ilike("description", `%${oldDescSubstring}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (params.previousUserId) {
      query = query.eq("user_id", params.previousUserId);
    }

    const { data: tickets } = await query;
    if (!tickets || tickets.length === 0) {
      return { success: false };
    }

    const ticket = tickets[0];
    const now = new Date();
    const eventStart = new Date(params.isoStart);
    const hoursDiff = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    let newStatus = ticket.status;
    let slaStatus = ticket.sla_status;

    if (["PENDIENTE", "EN_ESPERA"].includes(ticket.status)) {
      if (hoursDiff > 24) {
        newStatus = "EN_ESPERA";
        slaStatus = "paused";
      } else {
        newStatus = "PENDIENTE";
        slaStatus = "running";
      }
    }

    await adminSupabase
      .from("tickets")
      .update({
        user_id: params.newUserId || ticket.user_id,
        description: params.fullNewDescription,
        event_date: params.isoStart,
        status: newStatus,
        sla_status: slaStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    return { success: true };
  } catch (err) {
    console.error("Error syncing reservation ticket:", err);
    return { success: false };
  }
}
