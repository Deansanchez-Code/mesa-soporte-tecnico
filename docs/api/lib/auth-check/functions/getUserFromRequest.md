[**Mesa de Soporte Técnico - API Documentation**](../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../modules.md) / [lib/auth-check](../README.md) / getUserFromRequest

# Function: getUserFromRequest()

> **getUserFromRequest**(`req`): `Promise`\<`User` \| `null`\>

Defined in: [lib/auth-check.ts:18](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/lib/auth-check.ts#L18)

Validates that the request has a valid Supabase session.
Returns the user object if valid, or null if invalid.
NOTE: This relies on the Authorization header (Bearer token) passed from the client.

## Parameters

### req

`NextRequest`

## Returns

`Promise`\<`User` \| `null`\>
