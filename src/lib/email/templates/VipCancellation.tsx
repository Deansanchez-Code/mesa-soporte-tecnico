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
import * as React from "react";

interface VipCancellationProps {
  userName: string;
  eventTitle: string;
  date: string;
  cancelledBy: string; // Nombre del VIP
}

export const VipCancellation = ({
  userName,
  eventTitle,
  date,
  cancelledBy,
}: VipCancellationProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        Aviso Importante: Cancelación de Reserva por Prioridad Institucional
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* HEADER ALERTA */}
          <Section style={headerBarAlert} />
          <Section style={logoSection}>
            <Heading style={senaLogoText}>SENA</Heading>
            <Text style={subLogoText}>Mesa de Ayuda TIC</Text>
          </Section>

          {/* CONTENIDO PRINCIPAL */}
          <Section style={content}>
            <Heading style={h1Alert}>Reserva Cancelada</Heading>
            <Text style={text}>
              Hola <strong>{userName}</strong>,
            </Text>
            <Text style={text}>
              Te informamos que tu reserva para el evento{" "}
              <strong>&quot;{eventTitle}&quot;</strong> programada para el{" "}
              <strong>{date}</strong> ha debido ser cancelada.
            </Text>

            <Section style={alertBox}>
              <Text style={alertTitle}>MOTIVO: PRIORIDAD INSTITUCIONAL</Text>
              <Text style={alertText}>
                El espacio ha sido requerido por <strong>{cancelledBy}</strong>{" "}
                (Usuario con Rol Prioritario).
              </Text>
            </Section>

            <Text style={text}>
              Entendemos los inconvenientes que esto pueda causar. Esta acción
              responde a políticas de priorización de espacios para eventos de
              alta relevancia institucional.
            </Text>

            <Text style={text}>
              Te invitamos a reagendar tu actividad en otro horario disponible o
              consultar con la administración del auditorio para buscar
              alternativas.
            </Text>
          </Section>

          {/* FOOTER */}
          <Section style={footer}>
            <Text style={footerLegal}>
              Servicio Nacional de Aprendizaje - SENA
              <br />
              Gestión de Espacios y Auditorios
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default VipCancellation;

// STYLES
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

const headerBarAlert = {
  backgroundColor: "#CF142B", // Rojo Alerta (Institucional complementario o estándar UI)
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
  color: "#00324D",
  fontSize: "14px",
  fontWeight: "500",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
};

const content = {
  padding: "32px 32px",
};

const h1Alert = {
  color: "#CF142B",
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

const alertBox = {
  backgroundColor: "#FEF2F2",
  borderRadius: "8px",
  padding: "16px",
  margin: "24px 0",
  border: "1px solid #FCA5A5",
};

const alertTitle = {
  color: "#991B1B",
  fontSize: "12px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

const alertText = {
  color: "#7F1D1D",
  fontSize: "14px",
  margin: "0",
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
