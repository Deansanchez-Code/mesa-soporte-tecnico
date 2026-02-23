"use server";

import { EmailService } from "@/lib/email/email-service";
import { TicketNotification } from "@/lib/email/templates/TicketNotification";

/**
 * Acción de servidor para enviar un correo de prueba.
 */
export async function testEmailAction(to: string) {
  try {
    const result = await EmailService.send({
      to,
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
      return { success: false, error: result.error };
    }

    return { success: true, message: "Correo de prueba enviado exitosamente" };
  } catch (error) {
    console.error("Error en testEmailAction:", error);
    return { success: false, error: String(error) };
  }
}
