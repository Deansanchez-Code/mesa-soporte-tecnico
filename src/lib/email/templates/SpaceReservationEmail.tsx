import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface SpaceReservationEmailProps {
  spaceName: string; // "Ambiente 107" | "Biblioteca" | "Auditorio" | "Subdirección"
  requesterName: string;
  eventTitle: string;
  date: string;
  timeRange: string;
  specialRequirements?: string;
  coordinatorName?: string;
  type:
    | "NEW_REQUEST"
    | "APPROVED"
    | "CANCELLED"
    | "MODIFICATION_SUGGESTED"
    | "VIP_AUTOMATIC";
}

export const SpaceReservationEmail = ({
  spaceName = "Ambiente 107",
  requesterName,
  eventTitle,
  date,
  timeRange,
  specialRequirements,
  coordinatorName = "Norma Barrera",
  type,
}: SpaceReservationEmailProps) => {
  const isCancellation = type === "CANCELLED";
  const isApproval = type === "APPROVED" || type === "VIP_AUTOMATIC";
  const isModification = type === "MODIFICATION_SUGGESTED";
  const isNewRequest = type === "NEW_REQUEST";

  const statusColor = isCancellation
    ? "#CF142B"
    : isApproval
      ? "#39A900"
      : isModification
        ? "#F28B00"
        : "#00324D";

  const statusBadgeText = isCancellation
    ? "CANCELADA"
    : isApproval
      ? "CONFIRMADA"
      : isModification
        ? "MODIFICACIÓN SUGERIDA"
        : "EN ESPERA DE AUTORIZACIÓN";

  const emailSubjectTitle = isCancellation
    ? `Reserva Cancelada — ${spaceName}`
    : isApproval
      ? `¡Reserva Confirmada! — ${spaceName}`
      : isModification
        ? `Sugerencia de Ajuste — ${spaceName}`
        : `Solicitud de Prereserva — ${spaceName}`;

  return (
    <Html>
      <Head />
      <Preview>{`${spaceName}: ${emailSubjectTitle}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* BARRA SUPERIOR DE COLOR DE ESTADO */}
          <Section style={{ ...headerBar, backgroundColor: statusColor }} />

          {/* CABECERA INSTITUCIONAL */}
          <Section style={logoSection}>
            <Heading style={senaLogoText}>SENA</Heading>
            <Text style={subLogoText}>
              Mesa de Servicios TIC • Centro Agroempresarial
            </Text>
          </Section>

          {/* CUERPO DEL CORREO */}
          <Section style={content}>
            <div style={badgeContainer}>
              <span
                style={{
                  ...statusBadge,
                  backgroundColor: `${statusColor}15`,
                  color: statusColor,
                  borderColor: `${statusColor}40`,
                }}
              >
                {statusBadgeText}
              </span>
            </div>

            <Heading style={h1}>{emailSubjectTitle}</Heading>

            <Text style={text}>
              Apreciado(a) <strong>{requesterName}</strong>,
            </Text>

            <Text style={text}>
              {isNewRequest ? (
                <>
                  Tu solicitud para usar el <strong>{spaceName}</strong> ha sido
                  registrada exitosamente en el sistema. Al tratarse de un
                  espacio especializado, se encuentra provisionalmente reservado
                  y remitido a la coordinación correspondiente (
                  <strong>{coordinatorName}</strong>) para su validación
                  pedagógica y operativa.
                </>
              ) : type === "VIP_AUTOMATIC" ? (
                <>
                  Tu reserva para el <strong>{spaceName}</strong> ha sido
                  confirmada automáticamente bajo la prioridad institucional de
                  tu rol. Todos los recursos solicitados han quedado reservados.
                </>
              ) : isApproval ? (
                <>
                  Nos complace informarte que la coordinación ha{" "}
                  <strong>autorizado y confirmado</strong> tu reserva para el{" "}
                  <strong>{spaceName}</strong>. A continuación encontrarás todos
                  los detalles del evento:
                </>
              ) : isCancellation ? (
                <>
                  Te informamos con respeto que la reserva para el{" "}
                  <strong>{spaceName}</strong> ha sido cancelada. Te presentamos
                  el motivo registrado para que puedas reprogramar o ponerte en
                  contacto.
                </>
              ) : (
                <>
                  La coordinación ha revisado tu solicitud para el{" "}
                  <strong>{spaceName}</strong> y sugiere un pequeño ajuste para
                  garantizar el óptimo desarrollo de tu actividad:
                </>
              )}
            </Text>

            {/* TARJETA DE DETALLES DEL EVENTO */}
            <Section style={card}>
              <Text style={cardLabel}>ACTIVIDAD / EVENTO</Text>
              <Text style={cardValue}>{eventTitle}</Text>

              <Hr style={divider} />

              <Text style={cardLabel}>ESPACIO SOLICITADO</Text>
              <Text style={cardValue}>{spaceName}</Text>

              <Hr style={divider} />

              <Text style={cardLabel}>FECHA Y HORARIO</Text>
              <Text style={cardValue}>{date}</Text>
              <Text style={cardSubValue}>{timeRange}</Text>

              {specialRequirements &&
                specialRequirements.trim() &&
                specialRequirements.trim().toLowerCase() !== "ninguno" && (
                  <>
                    <Hr style={divider} />
                    <Text style={cardLabel}>
                      {isModification
                        ? "SUGERENCIA DE LA COORDINACIÓN"
                        : isCancellation
                          ? "MOTIVO DE LA CANCELACIÓN"
                          : "OBSERVACIONES / REQUERIMIENTOS"}
                    </Text>
                    <Text style={cardValue}>{specialRequirements}</Text>
                  </>
                )}
            </Section>

            {/* BOTÓN DE ACCIÓN */}
            <Section style={buttonContainer}>
              <Button
                style={{ ...button, backgroundColor: statusColor }}
                href="https://mesasoporte.sena.edu.co"
              >
                Ver en la Mesa de Ayuda TIC
              </Button>
            </Section>

            <Text style={signatureText}>
              Cordialmente,
              <br />
              <br />
              <strong>Equipo de Soporte y Ambientes TIC</strong>
              <br />
              Centro Agroempresarial y Desarrollo Pecuario del Huila
              <br />
              Servicio Nacional de Aprendizaje — SENA
            </Text>

            <Text style={footerText}>
              Este es un correo institucional generado automáticamente. Si
              requieres asistencia adicional, acércate a la coordinación
              correspondiente o ingresa a la plataforma.
            </Text>
          </Section>

          {/* PIE DE PÁGINA */}
          <Section style={footer}>
            <Text style={footerLegal}>
              Servicio Nacional de Aprendizaje SENA • Regional Huila
              <br />
              Tecnología, Innovación y Formación Profesional Integral
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default SpaceReservationEmail;

const main = {
  backgroundColor: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0",
  marginBottom: "40px",
  borderRadius: "16px",
  overflow: "hidden" as const,
  maxWidth: "600px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
};

const headerBar = {
  height: "6px",
  width: "100%",
};

const logoSection = {
  padding: "24px 32px 18px",
  borderBottom: "1px solid #f1f5f9",
  textAlign: "center" as const,
};

const senaLogoText = {
  margin: "0",
  color: "#39A900",
  fontSize: "30px",
  fontWeight: "900",
  letterSpacing: "1px",
};

const subLogoText = {
  margin: "4px 0 0",
  color: "#00324D",
  fontSize: "12px",
  fontWeight: "700",
  textTransform: "uppercase" as const,
  letterSpacing: "1.5px",
};

const badgeContainer = {
  textAlign: "center" as const,
  marginBottom: "12px",
};

const statusBadge = {
  display: "inline-block",
  padding: "6px 14px",
  borderRadius: "9999px",
  fontSize: "11px",
  fontWeight: "800",
  letterSpacing: "0.5px",
  border: "1px solid",
  textTransform: "uppercase" as const,
};

const content = {
  padding: "28px 32px",
};

const h1 = {
  color: "#00324D",
  fontSize: "22px",
  fontWeight: "800",
  margin: "0 0 16px",
  textAlign: "center" as const,
  letterSpacing: "-0.5px",
};

const text = {
  color: "#475569",
  fontSize: "15px",
  lineHeight: "24px",
  textAlign: "left" as const,
  margin: "0 0 16px",
};

const card = {
  backgroundColor: "#f8fafc",
  borderRadius: "12px",
  padding: "20px 24px",
  margin: "24px 0",
  border: "1px solid #e2e8f0",
};

const cardLabel = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: "800",
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px",
  margin: "0 0 4px",
};

const cardValue = {
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: "700",
  margin: "0",
};

const cardSubValue = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: "500",
  margin: "2px 0 0",
};

const divider = {
  borderColor: "#e2e8f0",
  margin: "12px 0",
};

const buttonContainer = {
  textAlign: "center" as const,
  marginTop: "24px",
};

const button = {
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 28px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
};

const signatureText = {
  color: "#475569",
  fontSize: "13px",
  lineHeight: "20px",
  textAlign: "left" as const,
  marginTop: "28px",
};

const footerText = {
  color: "#94a3b8",
  fontSize: "11px",
  lineHeight: "16px",
  textAlign: "center" as const,
  marginTop: "24px",
};

const footer = {
  backgroundColor: "#f1f5f9",
  padding: "20px",
  textAlign: "center" as const,
  borderTop: "1px solid #e2e8f0",
};

const footerLegal = {
  color: "#94a3b8",
  fontSize: "10px",
  lineHeight: "15px",
};
