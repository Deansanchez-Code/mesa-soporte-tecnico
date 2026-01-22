[**Mesa de Soporte Técnico - API Documentation**](../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../modules.md) / [lib/domain/sla-calculator](../README.md) / getSLAHours

# Function: getSLAHours()

> **getSLAHours**(`ticket`): `number`

Defined in: [lib/domain/sla-calculator.ts:23](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/lib/domain/sla-calculator.ts#L23)

Determina las horas de SLA según el tipo de ticket.
- VIP: 4 horas
- Incidente (INC): 8 horas
- Requerimiento (REQ): 24 horas

## Parameters

### ticket

[`Ticket`](../../../../app/admin/admin.types/interfaces/Ticket.md)

## Returns

`number`
