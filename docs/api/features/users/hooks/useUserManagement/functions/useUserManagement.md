[**Mesa de Soporte Técnico - API Documentation**](../../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../../modules.md) / [features/users/hooks/useUserManagement](../README.md) / useUserManagement

# Function: useUserManagement()

> **useUserManagement**(`onRefresh`): `object`

Defined in: [features/users/hooks/useUserManagement.ts:13](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/features/users/hooks/useUserManagement.ts#L13)

## Parameters

### onRefresh

() => `void`

## Returns

`object`

### handleCreateOrUpdateUser()

> **handleCreateOrUpdateUser**: () => `Promise`\<`string` \| `number` \| `undefined`\>

#### Returns

`Promise`\<`string` \| `number` \| `undefined`\>

### handleDeleteUser()

> **handleDeleteUser**: (`id`) => `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

### handleEditUser()

> **handleEditUser**: (`user`) => `void`

#### Parameters

##### user

[`Agent`](../../../../../app/admin/admin.types/interfaces/Agent.md)

#### Returns

`void`

### newAgent

> **newAgent**: [`AgentFormData`](../type-aliases/AgentFormData.md)

### resetUserForm()

> **resetUserForm**: () => `void`

#### Returns

`void`

### setNewAgent

> **setNewAgent**: `Dispatch`\<`SetStateAction`\<[`AgentFormData`](../type-aliases/AgentFormData.md)\>\>

### setShowAgentModal

> **setShowAgentModal**: `Dispatch`\<`SetStateAction`\<`boolean`\>\>

### showAgentModal

> **showAgentModal**: `boolean`
