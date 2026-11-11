import { NextResponse } from "next/server";

// ISO 27001 A.5.17 / A.8.5: Reemplazado por verificación OTP segura (/api/auth/kiosk-otp)
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Endpoint de autenticación heredado deshabilitado. Utiliza el flujo de verificación OTP en /api/auth/kiosk-otp.",
    },
    { status: 410 },
  );
}
