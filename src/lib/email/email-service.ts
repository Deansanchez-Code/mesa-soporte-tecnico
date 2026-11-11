import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import React from "react";

export interface EmailPayload {
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  text?: string;
  html?: string;
}

export class EmailService {
  /**
   * Envía un correo electrónico utilizando Nodemailer (Gmail SMTP).
   */
  static async send(payload: EmailPayload) {
    try {
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpUser || !smtpPass) {
        console.error(
          "❌ ERROR CRÍTICO: SMTP_USER o SMTP_PASS no están definidos en las variables de entorno.",
        );
        return {
          success: false,
          error: "Server Configuration Error: Missing SMTP Credentials",
        };
      }

      // Configuración del transportador para Gmail
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Renderizar el componente de React Email a HTML o usar html/texto plano
      let emailHtml = payload.html || "";
      if (payload.react) {
        emailHtml = await render(payload.react);
      } else if (!emailHtml && payload.text) {
        emailHtml = `<div style="font-family: sans-serif; white-space: pre-wrap; line-height: 1.5; color: #1e293b;">${payload.text}</div>`;
      }

      const mailOptions: {
        from: string;
        to: string | string[];
        subject: string;
        html?: string;
        text?: string;
      } = {
        from: `"Mesa de Ayuda TIC" <${smtpUser}>`,
        to: payload.to,
        subject: payload.subject,
        html: emailHtml,
        ...(payload.text ? { text: payload.text } : {}),
      };

      const info = await transporter.sendMail(mailOptions);

      console.log(
        `✅ Correo enviado exitosamente a ${payload.to}. MessageId: ${info.messageId}`,
      );
      return { success: true, data: info };
    } catch (error) {
      console.error("⚠️ EmailService (Nodemailer) Exception:", error);
      return { success: false, error };
    }
  }
}
