[**Mesa de Soporte Técnico - API Documentation**](../../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../../modules.md) / [features/tickets/hooks/useTickets](../README.md) / useTickets

# Function: useTickets()

> **useTickets**(`currentUser`): `object`

Defined in: [features/tickets/hooks/useTickets.ts:6](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/features/tickets/hooks/useTickets.ts#L6)

## Parameters

### currentUser

`User` | `null`

## Returns

`object`

### agents

> **agents**: `object`[]

### error

> **error**: `string` \| `null`

### loading

> **loading**: `boolean`

### refreshTickets()

> **refreshTickets**: () => `Promise`\<`void`\> = `fetchTickets`

#### Returns

`Promise`\<`void`\>

### tickets

> **tickets**: [`Ticket`](../../../../../app/admin/admin.types/interfaces/Ticket.md)[]
