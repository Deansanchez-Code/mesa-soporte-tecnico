[**Mesa de Soporte Técnico - API Documentation**](../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../modules.md) / [lib/auth-check](../README.md) / verifyUserPermissions

# Function: verifyUserPermissions()

> **verifyUserPermissions**(`userId`, `requiredRoles`, `requiredPermissionColumn?`): `Promise`\<`boolean`\>

Defined in: [lib/auth-check.ts:46](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/lib/auth-check.ts#L46)

Checks if the user has one of the allowed roles OR specific permissions.

## Parameters

### userId

`string`

### requiredRoles

`string`[] = `[]`

### requiredPermissionColumn?

`string`

## Returns

`Promise`\<`boolean`\>
