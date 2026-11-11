import {
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
  unauthorized,
} from "@/lib/auth-check";
import { NextRequest, NextResponse } from "next/server";

// ISO 27001 A.8.9 / A.8.13: Deshabilitar purga masiva destructiva en runtime
export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();
  if (!(await verifyUserPermissions(user.id, ["superadmin"]))) {
    return forbidden("Requires SuperAdmin");
  }

  return NextResponse.json(
    {
      error:
        "Purga masiva deshabilitada permanentemente por política ISO 27001 (Integridad y Disponibilidad).",
    },
    { status: 410 },
  );
}
