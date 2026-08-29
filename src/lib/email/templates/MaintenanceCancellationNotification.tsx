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

export interface ReservationItem {
  id: number;
  title: string;
  date: string;
  timeRange: string;
}

interface MaintenanceCancellationNotificationProps {
  userName: string;
  startDate: string;
  endDate?: string | null;
  reservations: ReservationItem[];
}

export const MaintenanceCancellationNotification = ({
  userName,
  startDate,
  endDate,
  reservations,
}: MaintenanceCancellationNotificationProps) => {
  const isMultiple = reservations.length > 1;

  return (
    <Html>
      <Head />
      <Preview>
        Aviso Importante: Cancelación de Reservas por Obras de Remodelación en
        Auditorio
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* HEADER ALERTA NARANJA */}
          <Section style={headerBarAlert} />
          <Section style={logoSection}>
            <Heading style={senaLogoText}>SENA</Heading>
            <Text style={subLogoText}>Mesa de Ayuda TIC</Text>
          </Section>

          {/* CONTENIDO PRINCIPAL */}
          <Section style={content}>
            <Heading style={h1Alert}>Aviso de Suspensión de Reservas</Heading>
            <Text style={text}>
              Respetado(a) <strong>{userName}</strong>,
            </Text>
            <Text style={text}>
              Le informamos que a partir del <strong>{startDate}</strong> el{" "}
              <strong>Auditorio Principal</strong> entrará en un proceso de{" "}
              <strong>
                obras de remodelación y adecuación de infraestructura
              </strong>
              .
            </Text>

            <Section style={alertBox}>
              <Text style={alertTitle}>
                ESTADO DEL ESPACIO: FUERA DE SERVICIO
              </Text>
              <Text style={alertText}>
                Debido a los trabajos programados,{" "}
                {isMultiple
                  ? `sus ${reservations.length} reservas registradas han debido ser canceladas automáticamente:`
                  : "su siguiente reserva registrada ha debido ser cancelada automáticamente:"}
              </Text>

              <div style={reservationListContainer}>
                {reservations.map((res) => (
                  <div key={res.id} style={reservationItemCard}>
                    <Text style={reservationItemTitle}>📌 {res.title}</Text>
                    <Text style={reservationItemMeta}>
                      🗓️ Fecha: <strong>{res.date}</strong> &nbsp;|&nbsp; ⏰
                      Horario: <strong>{res.timeRange}</strong>
                    </Text>
                  </div>
                ))}
              </div>

              <Text style={alertSubText}>
                {endDate
                  ? `🗓️ Fecha estimada de reapertura: ${endDate}.`
                  : "🚫 Suspensión activa por el resto de la vigencia 2026."}
              </Text>
            </Section>

            {/* MENSAJE DE DISCULPAS */}
            <Section style={disclaimerBox}>
              <Text style={disclaimerText}>
                🙏 <strong>Ofrecemos sinceras disculpas</strong> por los
                inconvenientes y las modificaciones que esta situación pueda
                ocasionar en su planificación.
              </Text>
              <Text style={disclaimerTextSecondary}>
                Para la organización de eventos institucionales prioritarios o
                reuniones extraordinarias, por favor comunicarse directamente
                con la <strong>Coordinación Académica o de Formación</strong>.
              </Text>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              Mesa de Ayuda TIC - Regional Cauca | Servicio Nacional de
              Aprendizaje SENA
              <br />
              Este es un mensaje generado automáticamente por el sistema de
              gestión de espacios.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// ESTILOS EN LÍNEA
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
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
  maxWidth: "600px",
};

const headerBarAlert = {
  height: "8px",
  backgroundColor: "#ea580c", // Naranja advertencia
};

const logoSection = {
  padding: "32px 32px 0 32px",
  textAlign: "center" as const,
};

const senaLogoText = {
  fontSize: "28px",
  fontWeight: "900",
  color: "#39a900",
  letterSpacing: "2px",
  margin: "0",
};

const subLogoText = {
  fontSize: "12px",
  fontWeight: "700",
  color: "#6b7280",
  letterSpacing: "1px",
  textTransform: "uppercase" as const,
  margin: "4px 0 0 0",
};

const content = {
  padding: "24px 32px 32px 32px",
};

const h1Alert = {
  color: "#9a3412",
  fontSize: "22px",
  fontWeight: "800",
  textAlign: "left" as const,
  margin: "16px 0 20px 0",
};

const text = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 14px 0",
};

const alertBox = {
  backgroundColor: "#fff7ed",
  border: "1px solid #ffedd5",
  borderLeft: "4px solid #ea580c",
  borderRadius: "12px",
  padding: "16px",
  margin: "20px 0",
};

const alertTitle = {
  color: "#9a3412",
  fontSize: "12px",
  fontWeight: "800",
  letterSpacing: "0.5px",
  textTransform: "uppercase" as const,
  margin: "0 0 8px 0",
};

const alertText = {
  color: "#7c2d12",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 12px 0",
};

const reservationListContainer = {
  margin: "12px 0",
};

const reservationItemCard = {
  backgroundColor: "#ffffff",
  border: "1px solid #fed7aa",
  borderRadius: "8px",
  padding: "10px 12px",
  marginBottom: "8px",
};

const reservationItemTitle = {
  color: "#1e293b",
  fontSize: "13px",
  fontWeight: "700",
  margin: "0 0 4px 0",
};

const reservationItemMeta = {
  color: "#64748b",
  fontSize: "12px",
  margin: "0",
};

const alertSubText = {
  color: "#9a3412",
  fontSize: "12px",
  fontWeight: "600",
  margin: "10px 0 0 0",
};

const disclaimerBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "14px",
  margin: "16px 0 24px 0",
};

const disclaimerText = {
  color: "#475569",
  fontSize: "13px",
  lineHeight: "19px",
  margin: "0 0 8px 0",
};

const disclaimerTextSecondary = {
  color: "#0369a1",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
};

const hr = {
  borderColor: "#f1f5f9",
  margin: "24px 0 16px 0",
};

const footer = {
  color: "#94a3b8",
  fontSize: "11px",
  lineHeight: "16px",
  textAlign: "center" as const,
  margin: "0",
};
