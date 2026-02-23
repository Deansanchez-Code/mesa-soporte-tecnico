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

interface TicketNotificationProps {
  userName: string;
  ticketId: string | number;
  category: string;
  description?: string;
  location: string;
  priority?: string;
}

export const TicketNotification = ({
  userName,
  ticketId,
  category,
  description,
  location,
  priority,
}: TicketNotificationProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        Solicitud de Soporte Recibida: Ticket #{String(ticketId)}
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
            <Heading style={h1}>Solicitud Recibida</Heading>
            <Text style={text}>
              Hola <strong>{userName}</strong>,
            </Text>
            <Text style={text}>
              Hemos recibido tu solicitud de soporte técnico. Se ha generado un
              ticket con la siguiente información:
            </Text>

            {/* TICKET CARD */}
            <Section style={card}>
              <Text style={cardLabel}>TICKET ID</Text>
              <Text style={cardValue}>#{String(ticketId)}</Text>

              <Hr style={divider} />

              <Text style={cardLabel}>CATEGORÍA</Text>
              <Text style={cardValue}>{category}</Text>

              <Hr style={divider} />

              <Text style={cardLabel}>UBICACIÓN</Text>
              <Text style={cardValue}>{location}</Text>

              {priority && (
                <>
                  <Hr style={divider} />
                  <Text style={cardLabel}>PRIORIDAD</Text>
                  <Text style={cardValue}>{priority}</Text>
                </>
              )}
            </Section>

            {description && (
              <>
                <Heading style={h2}>Descripción del Problema</Heading>
                <Section style={descriptionBox}>
                  <Text style={descriptionText}>{description}</Text>
                </Section>
              </>
            )}

            <Text style={paragraph}>
              Puedes seguir el estado de tu solicitud ingresando a nuestro{" "}
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

export default TicketNotification;

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

const h2 = {
  fontSize: "14px",
  fontWeight: "bold",
  color: "#555",
  textTransform: "uppercase" as const,
  marginTop: "24px",
  marginBottom: "12px",
};

const text = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const paragraph = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#525f7f",
  marginTop: "24px",
};

const link = {
  color: "#39A900",
  textDecoration: "underline",
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

const descriptionBox = {
  backgroundColor: "#f4f7f6",
  padding: "16px",
  borderRadius: "4px",
  border: "1px solid #e6ebf1",
};

const descriptionText = {
  color: "#525f7f",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0",
  whiteSpace: "pre-wrap" as const,
};

const divider = {
  borderColor: "#e6ebf1",
  margin: "12px 0",
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
