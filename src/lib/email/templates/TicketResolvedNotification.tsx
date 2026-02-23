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
  Link,
} from "@react-email/components";
import * as React from "react";

interface TicketResolvedNotificationProps {
  userName: string;
  ticketId: string;
  category: string;
  solution: string;
}

export const TicketResolvedNotification = ({
  userName,
  ticketId,
  category,
  solution,
}: TicketResolvedNotificationProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        Tu solicitud ha sido resuelta: Ticket #{String(ticketId)}
      </Preview>
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
            <Heading style={h1}>Solicitud Resuelta</Heading>
            <Text style={text}>
              Hola <strong>{userName}</strong>,
            </Text>
            <Text style={text}>
              Te informamos que tu solicitud de soporte técnico ha sido
              procesada y marcada como <strong>RESUELTA</strong>.
            </Text>

            {/* TICKET CARD */}
            <Section style={card}>
              <Text style={cardLabel}>TICKET ID</Text>
              <Text style={cardValue}>#{String(ticketId)}</Text>

              <Hr style={divider} />

              <Text style={cardLabel}>CATEGORÍA</Text>
              <Text style={cardValue}>{category}</Text>
            </Section>

            {/* SOLUTION BOX */}
            <Heading style={h2}>Solución Brindada</Heading>
            <Section style={solutionBox}>
              <Text style={solutionText}>{solution}</Text>
            </Section>

            <Text style={paragraph}>
              Si consideras que el problema persiste o tienes dudas adicionales,
              puedes contactarnos nuevamente o revisar el estado en el{" "}
              <Link href="https://mesasoporte.sena.edu.co" style={link}>
                Portal de Mesa de Ayuda
              </Link>
              .
            </Text>
          </Section>

          {/* FOOTER */}
          <Section style={footer}>
            <Text style={footerLegal}>
              Servicio Nacional de Aprendizaje - SENA
              <br />
              Este es un correo automático, por favor no responder.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default TicketResolvedNotification;

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
  maxWidth: "520px",
  borderRadius: "12px",
  overflow: "hidden",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const headerBar = {
  backgroundColor: "#39A900", // Verde SENA
  height: "8px",
  width: "100%",
};

const logoSection = {
  padding: "32px",
  textAlign: "center" as const,
  borderBottom: "1px solid #f0f0f0",
};

const senaLogoText = {
  margin: "0",
  color: "#39A900",
  fontSize: "32px",
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
  padding: "40px 32px",
};

const h1 = {
  color: "#00324D",
  fontSize: "26px",
  fontWeight: "bold",
  margin: "0 0 20px",
  textAlign: "center" as const,
};

const h2 = {
  color: "#00324D",
  fontSize: "18px",
  fontWeight: "bold",
  margin: "32px 0 12px",
};

const text = {
  color: "#4a5568",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 16px",
};

const card = {
  backgroundColor: "#f8fafc",
  borderRadius: "12px",
  padding: "24px",
  margin: "24px 0",
  border: "1px solid #e2e8f0",
};

const cardLabel = {
  color: "#718096",
  fontSize: "12px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 4px",
};

const cardValue = {
  color: "#1a202c",
  fontSize: "18px",
  fontWeight: "700",
  margin: "0",
};

const divider = {
  borderColor: "#e2e8f0",
  margin: "16px 0",
};

const solutionBox = {
  backgroundColor: "#f0fff4", // Light green background
  borderRadius: "8px",
  padding: "20px",
  border: "1px solid #c6f6d5",
  margin: "0 0 24px",
};

const solutionText = {
  color: "#22543d",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0",
  fontStyle: "italic",
};

const paragraph = {
  color: "#718096",
  fontSize: "14px",
  lineHeight: "22px",
  marginTop: "24px",
};

const link = {
  color: "#39A900",
  textDecoration: "underline",
  fontWeight: "600",
};

const footer = {
  backgroundColor: "#f7fafc",
  padding: "32px",
  textAlign: "center" as const,
  borderTop: "1px solid #edf2f7",
};

const footerLegal = {
  color: "#a0aec0",
  fontSize: "12px",
  lineHeight: "18px",
};
