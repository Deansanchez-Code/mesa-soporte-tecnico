"use server";

import { z } from "zod";
import { EmailService } from "@/lib/email/email-service";
import { TicketNotification } from "@/lib/email/templates/TicketNotification";
import { createClient } from "@/lib/supabase/server";
import { verifyUserPermissions } from "@/lib/auth-check";
import Logger from "@/lib/logger";

const TestEmailSchema = z.string().trim().email("Correo destino inválido");

/**
 * Acción de servidor restringida a administradores para prueba SMTP.
 */
export async function testEmailAction(to: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const isAdmin = await verifyUserPermissions(user.id, [
      "admin",
      "superadmin",
    ]);
    if (!isAdmin) {
      return {
        success: false,
        error: "Acceso denegado: requiere privilegios administrativos",
      };
    }

    const parsedEmail = TestEmailSchema.safeParse(to);
    if (!parsedEmail.success) {
      return { success: false, error: "Dirección de correo inválida" };
    }

    const result = await EmailService.send({
      to: parsedEmail.data,
      subject: "PRUEBA DE CONEXIÓN: Mesa de Ayuda TIC",
      react: TicketNotification({
        userName: "Usuario de Prueba",
        ticketId: "TEST-123",
        category: "Prueba de Sistema",
        description:
          "Esta es una prueba de envío de correo utilizando Nodemailer y Gmail SMTP.",
        location: "Oficina Virtual",
        priority: "NORMAL",
      }),
    });

    if (!result.success) {
      return { success: false, error: "Fallo enviando correo SMTP" };
    }

    return { success: true, message: "Correo de prueba enviado exitosamente" };
  } catch (error) {
    Logger.error("Error en testEmailAction", error);
    return { success: false, error: "Error enviando prueba SMTP" };
  }
}
