import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

interface KioskOtpEmailProps {
  userName: string;
  otpCode: string;
  expiresMinutes?: number;
}

export function KioskOtpEmail({
  userName,
  otpCode,
  expiresMinutes = 10,
}: KioskOtpEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Tu código de acceso a Mesa de Ayuda TIC: {otpCode}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={headerTitle}>Mesa de Ayuda TIC — SENA</Heading>
            <Text style={headerSubtitle}>Verificación de Acceso Seguro</Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Hola, {userName}:</Text>
            <Text style={paragraph}>
              Recibimos una solicitud para ingresar al portal de{" "}
              <strong>Mesa de Ayuda TIC</strong>. Usa el siguiente código de un
              solo uso para validar tu identidad:
            </Text>

            <Section style={codeBox}>
              <Text style={codeText}>{otpCode}</Text>
            </Section>

            <Text style={metaText}>
              Este código vence en <strong>{expiresMinutes} minutos</strong> y
              solo puede utilizarse una vez.
            </Text>

            <Text style={securityNotice}>
              Si no solicitaste este ingreso, ignora este mensaje y no compartas
              este código con nadie. Soporte TIC nunca te solicitará este código
              por teléfono ni chat.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: "24px 0",
};

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  margin: "0 auto",
  maxWidth: "480px",
  overflow: "hidden",
};

const header = {
  backgroundColor: "#39A900",
  padding: "20px 24px",
  textAlign: "center" as const,
};

const headerTitle = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: "700",
  margin: "0",
};

const headerSubtitle = {
  color: "#ecfdf5",
  fontSize: "12px",
  margin: "4px 0 0",
};

const content = {
  padding: "24px",
};

const greeting = {
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: "600",
  margin: "0 0 12px",
};

const paragraph = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const codeBox = {
  backgroundColor: "#f0fdf4",
  border: "2px dashed #39A900",
  borderRadius: "10px",
  padding: "16px",
  textAlign: "center" as const,
  marginBottom: "18px",
};

const codeText = {
  color: "#04324d",
  fontSize: "30px",
  fontWeight: "800",
  letterSpacing: "8px",
  margin: "0",
};

const metaText = {
  color: "#475569",
  fontSize: "13px",
  margin: "0 0 16px",
};

const securityNotice = {
  backgroundColor: "#fff7ed",
  borderLeft: "4px solid #fb923c",
  color: "#7c2d12",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0",
  padding: "10px 12px",
};
