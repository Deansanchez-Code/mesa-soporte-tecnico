[**Mesa de Soporte Técnico - API Documentation**](../../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../../modules.md) / [features/tickets/hooks/useTicketDetails](../README.md) / useTicketDetails

# Function: useTicketDetails()

> **useTicketDetails**(`__namedParameters`): `object`

Defined in: [features/tickets/hooks/useTicketDetails.ts:12](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/features/tickets/hooks/useTicketDetails.ts#L12)

## Parameters

### \_\_namedParameters

`UseTicketDetailsProps`

## Returns

`object`

### events

> **events**: [`TicketEvent`](../../../types/interfaces/TicketEvent.md)[]

### handlePause()

> **handlePause**: (`selectedReason`, `customReason`) => `Promise`\<`void`\>

#### Parameters

##### selectedReason

`string`

##### customReason

`string`

#### Returns

`Promise`\<`void`\>

### handleResume()

> **handleResume**: () => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

### loadingEvents

> **loadingEvents**: `boolean`

### pauseReasons

> **pauseReasons**: [`PauseReason`](../../../types/interfaces/PauseReason.md)[]

### processingAction

> **processingAction**: `boolean`

### refreshEvents()

> **refreshEvents**: () => `Promise`\<`void`\> = `fetchDetails`

#### Returns

`Promise`\<`void`\>

### timelineItems

> **timelineItems**: [`TimelineItem`](../../../types/interfaces/TimelineItem.md)[]
