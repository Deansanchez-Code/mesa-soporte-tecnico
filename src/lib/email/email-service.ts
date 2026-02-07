import { Resend } from "resend";

export interface EmailPayload {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
}

export class EmailService {
  /**
   * Envía un correo electrónico utilizando Resend.
   * Maneja errores y retorna el resultado de la operación.
   */
  static async send(payload: EmailPayload) {
    try {
      const apiKey = process.env.RESEND_API_KEY;

      if (!apiKey) {
        console.error(
          "❌ ERROR CRÍTICO: RESEND_API_KEY no está definida en las variables de entorno.",
        );
        return {
          success: false,
          error: "Server Configuration Error: Missing Email API Key",
        };
      }

      const resend = new Resend(apiKey);

      const { data, error } = await resend.emails.send({
        from: "Mesa de Ayuda TIC <onboarding@resend.dev>", // TODO: Cambiar a dominio verificado en prod
        to: payload.to,
        subject: payload.subject,
        react: payload.react,
      });

      if (error) {
        console.error("Error enviando correo:", error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error("Excepción en EmailService:", error);
      return { success: false, error };
    }
  }
}
