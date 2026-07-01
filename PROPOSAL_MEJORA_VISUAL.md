# Propuesta de Rediseño Visual y de Experiencia de Usuario (UX/UI)

Esta propuesta detalla las mejoras visuales, estéticas y de usabilidad sugeridas para modernizar la plataforma de la **Mesa de Ayuda TIC** del Centro Agroempresarial y Desarrollo Pecuario del Huila (SENA). El objetivo es transformar la interfaz actual en una experiencia digital de primer nivel, intuitiva, profesional y visualmente atractiva.

---

## 🎨 Resumen de las Mejoras Clave

### 1. Simplificación del Dashboard (Eliminación de Soporte Técnico)

- **Estado de la Modificación:** Se ha **removido por completo** la columna e interfaz de reporte de Soporte Técnico en el menú principal, ya que el servicio técnico se gestionará exclusivamente por canales de correo corporativos.
- **Ajuste de Grid a 2 Columnas:** Al eliminar esta columna, el layout del panel de selección pasa de 3 a **2 columnas principales**, lo que permite una simetría y balance perfectos:
  1.  **Columna Izquierda (Reservas & Espacios):** Acceso directo para reservar el Auditorio, la Subdirección y la Biblioteca.
  2.  **Columna Derecha (Servicios & Consulta):** Acceso rápido para la visualización en tiempo real de Disponibilidad de Ambientes.
- **¿Por qué mejora?:** Menos opciones reducen la sobrecarga cognitiva del usuario. El nuevo diseño de 2 columnas aprovecha mejor el ancho de pantalla en monitores y tablets, distribuyendo el peso visual equitativamente y guiando al usuario sin distracciones hacia las funcionalidades activas de reservas e información.

### 2. Tipografía y Fundamentos de Layout

- **Estado Actual:** Uso de tipografías genéricas (`Arial`, `Helvetica`, `sans-serif`) y layouts estándar con bordes rígidos.
- **Propuesta de Mejora:**
  - Integrar **Plus Jakarta Sans** u **Outfit** mediante Next.js Font Optimization (`next/font/google`). Estas familias tipográficas son modernas, legibles a cualquier escala y aportan un carácter tecnológico y limpio.
  - Implementar layouts más orgánicos con bordes muy redondeados (`rounded-2xl` y `rounded-3xl`) y espaciados dinámicos que se adapten con mayor fluidez a distintos dispositivos.
- **¿Por qué mejora?:** La tipografía es el 70% del diseño de interfaz. Un tipo de letra moderno cambia drásticamente la percepción del software, haciéndolo ver como un producto de software moderno de calidad empresarial.

### 3. Paleta de Colores Elevada y Degradados (Gradients)

- **Estado Actual:** Bloques de color plano basados en los colores corporativos del SENA (`#39a900`, `#fc7323`, `#043263`).
- **Propuesta de Mejora:**
  - Crear transiciones suaves y degradados sofisticados que mezclen de forma armónica los tonos institucionales (ej. `from-emerald-600 to-teal-500` para verde SENA, `from-orange-500 to-amber-500` para naranja SENA, y un azul profundo `slate-900` para fondos oscuros o textos principales).
  - Utilizar tonos HSL personalizados con menor saturación de fondo para evitar la fatiga visual.
- **¿Por qué mejora?:** Los colores corporativos aplicados de forma plana pueden sentirse rígidos o toscos. La transición hacia degradados y paletas HSL suavizadas eleva el aspecto estético, aportando dinamismo sin perder la identidad de la marca SENA.

### 4. Profundidad Visual y Glassmorphism (Vidrio Esmerilado)

- **Estado Actual:** Tarjetas completamente blancas sobre fondos planos grises, lo que da un aspecto bidimensional.
- **Propuesta de Mejora:**
  - Diseñar las tarjetas principales con un efecto de **Glassmorphism** utilizando propiedades de CSS moderno como `backdrop-filter: blur(12px)` combinado con un fondo semi-translúcido (`bg-white/80` o `bg-slate-900/80` para modo oscuro).
  - Añadir un sutil patrón de malla o puntos en SVG para el fondo general del sitio (`mesh gradient`).
  - Aplicar sombras más suaves y difusas (`shadow-xl shadow-slate-100/50`) en lugar de bordes marcados.
- **¿Por qué mejora?:** El uso de capas translúcidas y sombras sutiles genera profundidad visual ("eje Z"), facilitando que el usuario distinga jerarquías y se concentre en el contenido de la tarjeta activa.

### 5. Rediseño del Dashboard de Selección (Tarjetas Interactivas)

- **Estado Actual:** Tarjetas con sombreados simples y bordes básicos.
- **Propuesta de Mejora:**
  - Rediseñar las tarjetas de selección para que parezcan "baldosas interactivas" con micro-interacciones (efecto de escala suave al pasar el cursor, brillos dinámicos en los bordes y cambio de color del icono en hover).
  - Reorganizar los iconos (`lucide-react`) haciéndolos más grandes y envolviéndolos en contenedores con degradados suaves alineados al tipo de servicio.
  - Incorporar indicadores de estado dinámicos (ej: un punto verde parpadeante si hay disponibilidad del auditorio en tiempo real).
- **¿Por qué mejora?:** Hace que el proceso de decisión del usuario sea mucho más interactivo y agradable. Las micro-animaciones guían la mirada y confirman la interactividad del elemento de forma intuitiva.

### 6. Formularios e Ingreso Pulido (UX de Entrada)

- **Estado Actual:** Campos de entrada sencillos y botones estándar de enviar.
- **Propuesta de Mejora:**
  - Implementar inputs con etiquetas flotantes (Floating Labels) que se eleven cuando el usuario haga foco.
  - Incluir iconos contextuales dentro de los campos para reforzar la entrada solicitada (ej. un sobre en el email, un usuario en el nombre).
  - Añadir animaciones de carga fluidas y estados "Skeleton" en lugar del spinner clásico de carga para dar una sensación de velocidad.
- **¿Por qué mejora?:** Reduce los errores de entrada y la fricción inicial. Un formulario interactivo e inteligente disminuye el tiempo requerido para ingresar información.

---

## 📈 Resumen Técnico de Cambios Propuestos

| Componente                  | Cambio Propuesto                                                      | Impacto en Usabilidad (UX)                                                  |
| :-------------------------- | :-------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **Grid del Dashboard**      | Transición de 3 columnas a **2 columnas balanceadas**.                | Mayor simetría, simplicidad visual y enfoque en las acciones reales.        |
| **Fondo General**           | Malla de degradado con patrón de puntos SVG.                          | Reduce la monotonía del fondo y centra la atención en la tarjeta principal. |
| **Tipografía**              | Cambiar a `Plus Jakarta Sans`.                                        | Mayor legibilidad y estética limpia en pantallas de alta resolución.        |
| **Tarjetas Principales**    | Glassmorphism y bordes `rounded-3xl` con sombras suaves.              | Interfaz con sensación premium que transmite profesionalismo y modernidad.  |
| **Cards de Selección**      | Hover dinámico con escalamiento `scale-102` y destellos de borde.     | Mayor feedback táctil y visual; guía al usuario en la toma de decisiones.   |
| **Formularios de Registro** | Campos con validación interactiva, iconos y bordes animados en Focus. | Menor tasa de error al registrar datos y mayor comodidad en móviles.        |

---

## 🚀 Próximos Pasos Recomendados

Para aplicar estas mejoras en esta rama (`visual-improvement-proposal`), se propone:

1.  **Actualizar el sistema de diseño en `globals.css`**: Definir nuevas variables CSS para degradados, sombras personalizadas y el patrón de fondo.
2.  **Configurar la tipografía en `layout.tsx`** importando la fuente desde `next/font/google`.
3.  **Modernizar el componente de login (`page.tsx`)** utilizando un diseño dividido (un panel visual institucional y un formulario moderno).
4.  **Refactorizar `UserRequestForm.tsx`** con tarjetas de selección en formato de baldosas interactivas y efectos de iluminación en hover.
