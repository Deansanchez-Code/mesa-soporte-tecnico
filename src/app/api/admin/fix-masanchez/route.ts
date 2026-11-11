import { NextRequest, NextResponse } from "next/server";
import {
  unauthorized,
  forbidden,
  getUserFromRequest,
  verifyUserPermissions,
} from "@/lib/auth-check";

// ISO 27001 A.8.9 / A.8.32: Endpoint de saneamiento puntual retirado de operación
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const isAdmin = await verifyUserPermissions(user.id, ["superadmin"]);
  if (!isAdmin) return forbidden("Requires Superadmin role");

  return NextResponse.json(
    {
      error:
        "Endpoint administrativo de migración puntual deshabilitado por política ISO 27001.",
    },
    { status: 410 },
  );
}
