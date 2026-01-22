[**Mesa de Soporte Técnico - API Documentation**](../../../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../../../modules.md) / [features/requests/components/hooks/useTicketRequest](../README.md) / useTicketRequest

# Function: useTicketRequest()

> **useTicketRequest**(`__namedParameters`): `object`

Defined in: [features/requests/components/hooks/useTicketRequest.ts:11](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/features/requests/components/hooks/useTicketRequest.ts#L11)

## Parameters

### \_\_namedParameters

`UseTicketRequestProps`

## Returns

`object`

### activeOutage

> **activeOutage**: [`Outage`](../../../types/interfaces/Outage.md) \| `null`

### areas

> **areas**: `string`[]

### assets

> **assets**: [`Asset`](../../../types/interfaces/Asset.md)[]

### category

> **category**: `string` \| `null`

### categoryGroups

> **categoryGroups**: `Record`\<`string`, `string`[]\>

### handleSubmitTicket()

> **handleSubmitTicket**: (`e`) => `Promise`\<`void`\>

#### Parameters

##### e

`FormEvent`

#### Returns

`Promise`\<`void`\>

### isLocationLocked

> **isLocationLocked**: `boolean`

### isSearching

> **isSearching**: `boolean`

### isSubmitting

> **isSubmitting**: `boolean`

### isValidSerial

> **isValidSerial**: `boolean`

### location

> **location**: `string`

### locationAssets

> **locationAssets**: [`Asset`](../../../types/interfaces/Asset.md)[]

### manualSerial

> **manualSerial**: `string`

### selectedAsset

> **selectedAsset**: `string`

### setCategory

> **setCategory**: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>

### setIsValidSerial

> **setIsValidSerial**: `Dispatch`\<`SetStateAction`\<`boolean`\>\>

### setLocation

> **setLocation**: `Dispatch`\<`SetStateAction`\<`string`\>\>

### setManualSerial

> **setManualSerial**: `Dispatch`\<`SetStateAction`\<`string`\>\>

### setSelectedAsset

> **setSelectedAsset**: `Dispatch`\<`SetStateAction`\<`string`\>\>

### setShowSuggestions

> **setShowSuggestions**: `Dispatch`\<`SetStateAction`\<`boolean`\>\>

### showSuggestions

> **showSuggestions**: `boolean`

### suggestions

> **suggestions**: [`Asset`](../../../types/interfaces/Asset.md)[]
