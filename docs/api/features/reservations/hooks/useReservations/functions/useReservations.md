[**Mesa de Soporte Técnico - API Documentation**](../../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../../modules.md) / [features/reservations/hooks/useReservations](../README.md) / useReservations

# Function: useReservations()

> **useReservations**(`__namedParameters`): `object`

Defined in: features/reservations/hooks/useReservations.ts:13

## Parameters

### \_\_namedParameters

`UseReservationsProps`

## Returns

`object`

### cancelReservation()

> **cancelReservation**: (`reservationId`) => `Promise`\<`boolean`\>

#### Parameters

##### reservationId

`number`

#### Returns

`Promise`\<`boolean`\>

### createOrUpdateReservation()

> **createOrUpdateReservation**: (`data`) => `Promise`\<`any`\>

#### Parameters

##### data

###### auditorium_id

`string`

###### end_time

`string`

###### id?

`number`

###### resources

`string`[]

###### start_time

`string`

###### title

`string`

###### user_id

`string`

#### Returns

`Promise`\<`any`\>

### createSupportTicket()

> **createSupportTicket**: (`data`) => `Promise`\<`any`\>

#### Parameters

##### data

###### category

`string`

###### description

`string`

###### location

`string`

###### ticket_type

`string`

###### user_id

`string`

#### Returns

`Promise`\<`any`\>

### currentUserVip

> **currentUserVip**: `boolean`

### loading

> **loading**: `boolean`

### refetch()

> **refetch**: () => `Promise`\<`void`\> = `fetchReservations`

#### Returns

`Promise`\<`void`\>

### reservations

> **reservations**: [`Reservation`](../../../types/interfaces/Reservation.md)[]

### setLoading

> **setLoading**: `Dispatch`\<`SetStateAction`\<`boolean`\>\>
