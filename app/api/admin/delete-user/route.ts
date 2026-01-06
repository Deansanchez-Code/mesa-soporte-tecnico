import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";

export async function POST(req: NextRequest) {
  try {
    // 1. SECURITY CHECK
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const isAdmin = await verifyUserPermissions(user.id, [
      "admin",
      "superadmin",
    ]);
    if (!isAdmin) return forbidden();

    const supabaseAdmin = getSupabaseAdmin();
    const { email } = await req.json();

    if (!email)
      return NextResponse.json({ error: "Email required" }, { status: 400 });

    // 1. Find User in Auth (Fetch large page to be sure)
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) throw listError;

    // Strict or partial match? User said "masanchez", typically an email prefix.
    // Let's look for exact match or contains.
    const targets = users.filter((u) =>
      u.email?.toLowerCase().includes(email.toLowerCase()),
    );

    if (targets.length === 0) {
      return NextResponse.json(
        { message: "User not found in Auth" },
        { status: 404 },
      );
    }

    const results = [];

    for (const user of targets) {
      // Safety: Don't delete SuperAdmin
      if (user.email?.includes("deansan")) {
        results.push({ email: user.email, status: "SKIPPED (Protected)" });
        continue;
      }

      console.log(`Deleting user: ${user.id}`); // Log ID only for audit, avoid PII if possible or keep minimal

      // 2. FORCE CLEANUP Dependencies (Manual Cascade)

      // A. Unassign Assets
      const { error: assetError } = await supabaseAdmin
        .from("assets")
        .update({ assigned_to_user_id: null })
        .eq("assigned_to_user_id", user.id);

      if (assetError) console.warn("Asset unassign error", assetError);

      // B. Delete Tickets (Created by or Assigned to)
      // Note: This is destructive. User asked to "Eliminate from everywhere".
      const { error: ticketError1 } = await supabaseAdmin
        .from("tickets")
        .delete()
        .eq("created_by", user.id);

      const { error: ticketError2 } = await supabaseAdmin
        .from("tickets")
        .delete()
        .eq("assigned_agent_id", user.id);

      if (ticketError1 || ticketError2)
        console.warn("Ticket delete error", ticketError1, ticketError2);

      // C. Delete Assignments (instructor_assignments)
      const { error: assignError } = await supabaseAdmin
        .from("instructor_assignments")
        .delete()
        .eq("user_id", user.id);

      if (assignError) console.warn("Assignment delete error", assignError);

      // 3. Delete from Auth (Should now succeed)
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(
        user.id,
      );

      if (delError) {
        results.push({
          email: user.email,
          status: `ERROR: ${delError.message}`,
        });
      } else {
        // 4. Delete from Public (Explicit cleanup just in case)
        const { error: publicError } = await supabaseAdmin
          .from("users")
          .delete()
          .eq("id", user.id);
        if (publicError)
          console.warn(
            "Public delete error (might be already gone)",
            publicError,
          );

        results.push({ email: user.email, status: "DELETED" });
      }
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
