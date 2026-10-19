---
name: transactional-email-design
description: Estándares de diseño y maquetación de correos electrónicos transaccionales profesionales utilizando React Email (@react-email/components). Garantiza compatibilidad universal (Outlook, Gmail, Apple Mail), diseño responsivo, accesibilidad visual y estética premium institucional con badges, tablas limpias y botones accesibles.
---

# Transactional Email Design Guide (React Email • +15k ⭐)

Lineamientos de diseño visual y de maquetación para correos transaccionales con `@react-email/components`.

## 1. Arquitectura y Compatibilidad

1. **Estructura Estándar:**
   - Contenedor con ancho máximo de `600px`.
   - Colores compatibles con modo oscuro y modo claro mediante fondos neutros suaves (`#F8FAFC`).
   - Sin propiedades CSS modernas no soportadas en clientes antiguos (evitar `grid`, `flex` anidados complejos, o `calc()`). Usar tablas, `Section`, `Container`, y estilos inline.

2. **Paleta Institucional SENA:**
   - Verde Primario: `#39A900`
   - Azul Marino Institucional: `#00324D`
   - Naranja Acento: `#F28B00`
   - Rojo Alerta/Cancelación: `#CF142B`
   - Texto Principal: `#1E293B`
   - Texto Secundario: `#64748B`

---

## 2. Componentes Clave

- **Header Institucional:** Banner de color de estado + logotipo SENA + subtítulo del centro o servicio.
- **Badge de Estado:** Píldora redondeada con color semántico (`Aprobado`, `En Revisión`, `Cancelado`).
- **Data Card:** Contenedor tipo tarjeta (`#FFFFFF`, borde sutil `#E2E8F0`, esquinas redondeadas) con etiquetas en mayúsculas pequeñas y valores destacados.
- **Llamado a la Acción (CTA):** Botón centrado o alineado con padding vertical y horizontal amplio, esquinas redondeadas y contraste AA.
- **Firma Institucional:** Despedida cordial, nombre del área, datos de contacto y enlace a la plataforma.

---

## 3. Ejemplo de Estilos Limpios

```typescript
export const emailTheme = {
  main: {
    backgroundColor: "#f1f5f9",
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  },
  container: {
    margin: "0 auto",
    padding: "32px 16px",
    maxWidth: "580px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid #e2e8f0",
  },
  badge: (color: string) => ({
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "bold",
    backgroundColor: `${color}15`,
    color: color,
  }),
};
```
