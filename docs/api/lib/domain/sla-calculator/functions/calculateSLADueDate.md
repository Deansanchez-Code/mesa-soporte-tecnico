[**Mesa de Soporte Técnico - API Documentation**](../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../modules.md) / [lib/domain/sla-calculator](../README.md) / calculateSLADueDate

# Function: calculateSLADueDate()

> **calculateSLADueDate**(`startDate`, `hoursDuration`): `Date`

Defined in: [lib/domain/sla-calculator.ts:36](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/lib/domain/sla-calculator.ts#L36)

Calcula la fecha de vencimiento basada en una duración en horas,
respetando el horario laboral (saltando noches y fines de semana).

## Parameters

### startDate

Fecha de inicio (usualmente created_at)

`string` | `Date`

### hoursDuration

`number`

Duración del SLA en horas

## Returns

`Date`

Date Fecha de vencimiento estimada
