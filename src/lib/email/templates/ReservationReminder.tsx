import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface ReservationReminderProps {
  userName: string;
  eventTitle: string;
  date: string;
  timeRange: string;
  location: string;
  resources: string[];
  specialRequirements?: string | null;
  reminderType: "ONE_DAY" | "FIFTEEN_MIN";
}

export const ReservationReminder = ({
  userName,
  eventTitle,
  date,
  timeRange,
  location,
  resources,
  specialRequirements,
  reminderType,
}: ReservationReminderProps) => {
  const isOneDay = reminderType === "ONE_DAY";
  const previewText = isOneDay
    ? `Recordatorio: Tu evento "${eventTitle}" es mañana`
    : `¡Atención! Tu evento "${eventTitle}" comienza en 15 minutos`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* HEADER INSTITUCIONAL */}
          <Section style={headerBar} />
          <Section style={logoSection}>
            <Heading style={senaLogoText}>SENA</Heading>
            <Text style={subLogoText}>Mesa de Ayuda TIC</Text>
          </Section>

          {/* CONTENIDO PRINCIPAL */}
          <Section style={content}>
            <Heading style={h1}>
              {isOneDay ? "Recordatorio de Evento" : "Comienza en 15 Minutos"}
            </Heading>
            <Text style={text}>
              Hola <strong>{userName}</strong>,
            </Text>
            <Text style={text}>
              {isOneDay
                ? "Te recordamos que tienes una reserva programada para el día de mañana. Aquí tienes los detalles:"
                : "Tu evento está por comenzar. Te compartimos un resumen de la reserva:"}
            </Text>

            {/* DATA CARD */}
            <Section style={card}>
              <Text style={cardLabel}>EVENTO</Text>
              <Text style={cardValue}>{eventTitle}</Text>

              <Hr style={divider} />

              <Text style={cardLabel}>CUÁNDO</Text>
              <Text style={cardValue}>{date}</Text>
              <Text style={cardSubValue}>{timeRange}</Text>

              <Hr style={divider} />

              <Text style={cardLabel}>DÓNDE</Text>
              <Text style={cardValue}>{location}</Text>

              {resources && resources.length > 0 && (
                <>
                  <Hr style={divider} />
                  <Text style={cardLabel}>RECURSOS</Text>
                  <Text style={cardValue}>{resources.join(", ")}</Text>
                </>
              )}

              {specialRequirements && (
                <>
                  <Hr style={divider} />
                  <Text style={cardLabel}>REQUERIMIENTOS ESPECIALES</Text>
                  <Text style={cardValue}>{specialRequirements}</Text>
                </>
              )}
            </Section>

            <Text style={footerText}>
              Por favor, asegúrate de llegar con anticipación para la
              preparación técnica si es necesario.
            </Text>
          </Section>

          {/* FOOTER */}
          <Section style={footer}>
            <Text style={footerLegal}>
              Servicio Nacional de Aprendizaje - SENA
              <br />
              Este es un correo automático de recordatorio, por favor no
              responder.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default ReservationReminder;

// STYLES (Consistentes con ReservationConfirmation para uniformidad)
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0",
  marginBottom: "64px",
  maxWidth: "480px",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const headerBar = {
  backgroundColor: "#39A900", // Verde SENA
  height: "8px",
  width: "100%",
};

const logoSection = {
  padding: "24px 32px",
  borderBottom: "1px solid #e6ebf1",
  textAlign: "center" as const,
};

const senaLogoText = {
  margin: "0",
  color: "#39A900",
  fontSize: "28px",
  fontWeight: "bold",
  lineHeight: "1",
};

const subLogoText = {
  margin: "4px 0 0",
  color: "#00324D", // Azul SENA
  fontSize: "14px",
  fontWeight: "500",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
};

const content = {
  padding: "32px 32px",
};

const h1 = {
  color: "#00324D",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0 0 16px",
  textAlign: "center" as const,
};

const text = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const card = {
  backgroundColor: "#F9FAFB",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
  border: "1px solid #e6ebf1",
};

const cardLabel = {
  color: "#8898aa",
  fontSize: "11px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 4px",
};

const cardValue = {
  color: "#00324D",
  fontSize: "16px",
  fontWeight: "600",
  margin: "0",
};

const cardSubValue = {
  color: "#525f7f",
  fontSize: "14px",
  margin: "2px 0 0",
};

const divider = {
  borderColor: "#e6ebf1",
  margin: "12px 0",
};

const footerText = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  textAlign: "center" as const,
  marginTop: "32px",
};

const footer = {
  backgroundColor: "#f6f9fc",
  padding: "24px",
  textAlign: "center" as const,
  borderTop: "1px solid #e6ebf1",
};

const footerLegal = {
  color: "#8898aa",
  fontSize: "10px",
  lineHeight: "16px",
};
