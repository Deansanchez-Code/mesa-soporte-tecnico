[**Mesa de Soporte Técnico - API Documentation**](../../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../../modules.md) / [features/assignments/hooks/useAssignments](../README.md) / useAssignments

# Function: useAssignments()

> **useAssignments**(`__namedParameters`): `object`

Defined in: features/assignments/hooks/useAssignments.ts:18

## Parameters

### \_\_namedParameters

`UseAssignmentsProps`

## Returns

`object`

### assignments

> **assignments**: [`Assignment`](../../../types/interfaces/Assignment.md)[]

### deleteAssignment()

> **deleteAssignment**: (`id`, `isReservation`) => `Promise`\<\{ `error?`: `undefined`; `success`: `boolean`; \} \| \{ `error`: `string`; `success`: `boolean`; \}\>

#### Parameters

##### id

`number`

##### isReservation

`boolean`

#### Returns

`Promise`\<\{ `error?`: `undefined`; `success`: `boolean`; \} \| \{ `error`: `string`; `success`: `boolean`; \}\>

### loading

> **loading**: `boolean`

### refetch()

> **refetch**: () => `Promise`\<`void`\> = `fetchAssignments`

#### Returns

`Promise`\<`void`\>
