import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface SupportNotificationProps {
  requesterName: string;
  requesterEmail?: string;
  eventTitle: string;
  date: string;
  timeRange: string;
  specialRequirements: string;
  type: "NEW_REQUIREMENT" | "CANCELLED_REQUIREMENT";
  cancelledBy?: string;
}

export const SupportNotification = ({
  requesterName,
  requesterEmail,
  eventTitle,
  date,
  timeRange,
  specialRequirements,
  type,
  cancelledBy,
}: SupportNotificationProps) => {
  const isCancellation = type === "CANCELLED_REQUIREMENT";
  const statusColor = isCancellation ? "#CF142B" : "#00324D"; // Rojo o Azul
  const title = isCancellation
    ? "REQUERIMIENTO CANCELADO"
    : "NUEVO REQUERIMIENTO ESPECIAL";

  return (
    <Html>
      <Head />
      <Preview>
        {isCancellation
          ? "Aviso de Cancelación de Recursos"
          : "Alerta: Nuevos Requerimientos Especiales"}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ ...headerBar, backgroundColor: statusColor }} />

          <Section style={content}>
            <Heading style={{ ...h1, color: statusColor }}>{title}</Heading>

            {isCancellation ? (
              <Text style={text}>
                El evento <strong>&quot;{eventTitle}&quot;</strong> ha sido
                cancelado por prioridad institucional (por {cancelledBy}).
                <br />
                <strong>Acción:</strong> Cancelar la gestión de los recursos
                especiales listados abajo.
              </Text>
            ) : (
              <Text style={paragraph}>
                Si deseas cancelar o modificar esta solicitud, por favor ingresa
                al{" "}
                <Link href="https://mesasoporte.sena.edu.co" style={link}>
                  Portal de Mesa de Ayuda
                </Link>
                .
              </Text>
            )}

            <Section style={infoBox}>
              <Text style={label}>Solicitante</Text>
              <Text style={value}>{requesterName}</Text>
              {requesterEmail && <Text style={subValue}>{requesterEmail}</Text>}

              <Hr style={divider} />

              <Text style={label}>Evento</Text>
              <Text style={value}>{eventTitle}</Text>

              <Text style={label}>Fecha y Hora</Text>
              <Text style={value}>
                {date} | {timeRange}
              </Text>
            </Section>

            <Heading style={h2}>Detalle del Requerimiento</Heading>
            <Section style={requirementBox}>
              <Text style={requirementText}>{specialRequirements}</Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default SupportNotification;

// STYLES
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: "monospace", // Monospace para toque técnico/administrativo
};

const paragraph = {
  fontSize: "14px",
  lineHeight: "24px",
  margin: "16px 0",
  color: "#333",
};

const link = {
  color: "#007bff",
  textDecoration: "underline",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px", // Más ancho para lectura técnica
  border: "1px solid #e6ebf1",
};

const headerBar = {
  height: "4px",
  width: "100%",
};

const content = {
  padding: "32px",
};

const h1 = {
  fontSize: "20px",
  fontWeight: "bold",
  margin: "0 0 24px",
  borderBottom: "1px solid #eee",
  paddingBottom: "12px",
};

const h2 = {
  fontSize: "14px",
  fontWeight: "bold",
  color: "#555",
  textTransform: "uppercase" as const,
  marginTop: "24px",
  marginBottom: "12px",
};

const text = {
  color: "#333",
  fontSize: "14px",
  lineHeight: "20px",
  marginBottom: "24px",
};

const infoBox = {
  backgroundColor: "#f9f9f9",
  padding: "16px",
  borderRadius: "4px",
};

const label = {
  color: "#666",
  fontSize: "10px",
  textTransform: "uppercase" as const,
  fontWeight: "bold",
  marginBottom: "4px",
  marginTop: "12px",
};

const value = {
  color: "#000",
  fontSize: "14px",
  fontWeight: "500",
  marginBottom: "0",
};

const subValue = {
  color: "#666",
  fontSize: "12px",
};

const divider = {
  borderColor: "#eee",
  margin: "12px 0",
};

const requirementBox = {
  backgroundColor: "#FFFBEB", // Amarillo suave
  border: "1px solid #FEF3C7",
  padding: "20px",
  borderRadius: "4px",
};

const requirementText = {
  color: "#92400E",
  fontSize: "14px",
  whiteSpace: "pre-wrap" as const, // Respetar saltos de línea del usuario
  margin: "0",
};
