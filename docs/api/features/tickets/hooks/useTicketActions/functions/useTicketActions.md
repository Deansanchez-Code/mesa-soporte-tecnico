[**Mesa de Soporte Técnico - API Documentation**](../../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../../modules.md) / [features/tickets/hooks/useTicketActions](../README.md) / useTicketActions

# Function: useTicketActions()

> **useTicketActions**(`tickets`, `onUpdate`, `currentUser`): `object`

Defined in: [features/tickets/hooks/useTicketActions.ts:6](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/features/tickets/hooks/useTicketActions.ts#L6)

## Parameters

### tickets

[`Ticket`](../../../../../app/admin/admin.types/interfaces/Ticket.md)[]

### onUpdate

() => `void`

### currentUser

`User` | `null`

## Returns

`object`

### handleCategoryChange()

> **handleCategoryChange**: (`ticketId`, `newCategory`) => `Promise`\<`void`\>

#### Parameters

##### ticketId

`number`

##### newCategory

`string`

#### Returns

`Promise`\<`void`\>

### handleReassign()

> **handleReassign**: (`ticketId`, `newAgentId`) => `Promise`\<`void`\>

#### Parameters

##### ticketId

`number`

##### newAgentId

`string`

#### Returns

`Promise`\<`void`\>

### promptAddComment()

> **promptAddComment**: (`ticketId`, `currentDescription`) => `Promise`\<`void`\>

#### Parameters

##### ticketId

`number`

##### currentDescription

`string`

#### Returns

`Promise`\<`void`\>

### saveTicketComment()

> **saveTicketComment**: (`ticketId`, `newComment`, `currentDescription?`) => `Promise`\<`void`\>

#### Parameters

##### ticketId

`number`

##### newComment

`string`

##### currentDescription?

`string`

#### Returns

`Promise`\<`void`\>

### toggleHold()

> **toggleHold**: (`ticket`) => `Promise`\<`void`\>

#### Parameters

##### ticket

[`Ticket`](../../../../../app/admin/admin.types/interfaces/Ticket.md)

#### Returns

`Promise`\<`void`\>

### updateStatus()

> **updateStatus**: (`ticketId`, `newStatus`, `solutionText?`) => `Promise`\<`void`\>

#### Parameters

##### ticketId

`number`

##### newStatus

`string`

##### solutionText?

`string`

#### Returns

`Promise`\<`void`\>
