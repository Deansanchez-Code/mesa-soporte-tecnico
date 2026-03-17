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

interface LibraryNotificationProps {
  requesterName: string;
  eventTitle: string;
  date: string;
  timeRange: string;
  specialRequirements: string;
  type:
    | "NEW_REQUEST"
    | "APPROVED"
    | "CANCELLED"
    | "MODIFICATION_SUGGESTED"
    | "VIP_AUTOMATIC";
}

export const LibraryNotification = ({
  requesterName,
  eventTitle,
  date,
  timeRange,
  specialRequirements,
  type,
}: LibraryNotificationProps) => {
  const isCancellation = type === "CANCELLED";
  const isApproval = type === "APPROVED" || type === "VIP_AUTOMATIC";
  const isModification = type === "MODIFICATION_SUGGESTED";

  const statusColor = isCancellation
    ? "#CF142B"
    : isApproval
      ? "#39A900"
      : "#00324D";

  const title = isCancellation
    ? "Reserva Cancelada"
    : isApproval
      ? "Reserva Confirmada"
      : isModification
        ? "Sugerencia de Modificación"
        : "Solicitud de Reserva";

  return (
    <Html>
      <Head />
      <Preview>Biblioteca: {title}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* HEADER INSTITUCIONAL */}
          <Section style={{ ...headerBar, backgroundColor: statusColor }} />
          <Section style={logoSection}>
            <Heading style={senaLogoText}>SENA</Heading>
            <Text style={subLogoText}>Mesa de Ayuda TIC</Text>
          </Section>

          {/* CONTENIDO PRINCIPAL */}
          <Section style={content}>
            <Heading style={h1}>{title}</Heading>
            <Text style={text}>
              Respetado(a) <strong>{requesterName}</strong>,
            </Text>

            <Text style={text}>
              {type === "NEW_REQUEST" || type === "VIP_AUTOMATIC" ? (
                <>
                  Se ha generado una solicitud de reserva de espacio en la
                  Biblioteca. A continuación, le detallamos la información
                  correspondiente a su evento:
                </>
              ) : isCancellation ? (
                <>
                  Le informamos que su reserva de espacio en la biblioteca ha
                  sido cancelada. A continuación, le detallamos la información
                  de la actividad:
                </>
              ) : isApproval ? (
                <>
                  Nos complace informarle que su solicitud de reserva de espacio
                  en la biblioteca ha sido procesada de manera exitosa. A
                  continuación, le detallamos la información correspondiente a
                  su evento:
                </>
              ) : (
                <>
                  Le informamos que se ha sugerido una modificación para su
                  reserva en la biblioteca. A continuación, le detallamos la
                  información correspondiente:
                </>
              )}
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
              <Text style={cardValue}>Biblioteca</Text>

              {specialRequirements &&
                specialRequirements.trim() &&
                specialRequirements.trim().toLowerCase() !== "ninguno" && (
                  <>
                    <Hr style={divider} />
                    <Text style={cardLabel}>
                      {isModification
                        ? "SUGERENCIA / COMENTARIOS"
                        : isCancellation
                          ? "MOTIVO DE CANCELACIÓN"
                          : "REQUERIMIENTOS ESPECIALES"}
                    </Text>
                    <Text style={cardValue}>{specialRequirements}</Text>
                  </>
                )}
            </Section>

            {/* CTA ACCIONES */}
            <Section style={buttonContainer}>
              <Button
                style={{ ...button, backgroundColor: statusColor }}
                href="https://mesasoporte.sena.edu.co"
              >
                Ir a Mesa de Ayuda
              </Button>
            </Section>

            <Text style={signatureText}>
              Cordialmente,
              <br />
              <br />
              <strong>Mesa de Servicios TIC</strong>
              <br />
              Centro Agroempresarial y Desarrollo Pecuario del Huila
              <br />
              Servicio Nacional de Aprendizaje - SENA
            </Text>

            <Text style={footerText}>
              Si necesita realizar modificaciones o consultar el estado de su
              solicitud, le invitamos a ingresar a la plataforma.
            </Text>
          </Section>

          {/* FOOTER */}
          <Section style={footer}>
            <Text style={footerLegal}>
              Este es un correo generado automáticamente por el sistema Smart
              Dispatch. Por favor, no responda a este mensaje.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default LibraryNotification;

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
  whiteSpace: "pre-wrap" as const,
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

const buttonContainer = {
  textAlign: "center" as const,
  marginTop: "24px",
};

const button = {
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const signatureText = {
  color: "#525f7f",
  fontSize: "14px",
  lineHeight: "22px",
  textAlign: "left" as const,
  marginTop: "32px",
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
