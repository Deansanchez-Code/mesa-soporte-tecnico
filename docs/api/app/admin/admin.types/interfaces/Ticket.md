[**Mesa de Soporte Técnico - API Documentation**](../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../modules.md) / [app/admin/admin.types](../README.md) / Ticket

# Interface: Ticket

Defined in: [app/admin/admin.types.ts:3](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/admin.types.ts#L3)

## Extends

- [`Tables`](../../types/type-aliases/Tables.md)\<`"tickets"`\>

## Properties

### asset\_serial

> **asset\_serial**: `string` \| `null`

Defined in: [app/admin/types.ts:465](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L465)

#### Inherited from

`Tables.asset_serial`

***

### assets

> **assets**: \{ `model`: `string` \| `null`; `serial_number`: `string`; `type`: `string` \| `null`; \} \| `null`

Defined in: [app/admin/admin.types.ts:6](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/admin.types.ts#L6)

***

### assigned\_agent

> **assigned\_agent**: \{ `full_name`: `string`; \} \| `null`

Defined in: [app/admin/admin.types.ts:5](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/admin.types.ts#L5)

***

### assigned\_agent\_id

> **assigned\_agent\_id**: `string` \| `null`

Defined in: [app/admin/types.ts:466](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L466)

#### Inherited from

`Tables.assigned_agent_id`

***

### category

> **category**: `string` \| `null`

Defined in: [app/admin/types.ts:467](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L467)

#### Inherited from

`Tables.category`

***

### created\_at

> **created\_at**: `string` \| `null`

Defined in: [app/admin/types.ts:468](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L468)

#### Inherited from

`Tables.created_at`

***

### description

> **description**: `string` \| `null`

Defined in: [app/admin/types.ts:469](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L469)

#### Inherited from

`Tables.description`

***

### hold\_reason

> **hold\_reason**: `string` \| `null`

Defined in: [app/admin/types.ts:470](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L470)

#### Inherited from

`Tables.hold_reason`

***

### id

> **id**: `number`

Defined in: [app/admin/types.ts:471](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L471)

#### Inherited from

`Tables.id`

***

### is\_vip\_ticket

> **is\_vip\_ticket**: `boolean` \| `null`

Defined in: [app/admin/types.ts:472](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L472)

#### Inherited from

`Tables.is_vip_ticket`

***

### location

> **location**: `string`

Defined in: [app/admin/types.ts:473](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L473)

#### Inherited from

`Tables.location`

***

### sla\_clock\_stopped\_at

> **sla\_clock\_stopped\_at**: `string` \| `null`

Defined in: [app/admin/types.ts:474](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L474)

#### Inherited from

`Tables.sla_clock_stopped_at`

***

### sla\_expected\_end\_at

> **sla\_expected\_end\_at**: `string` \| `null`

Defined in: [app/admin/types.ts:475](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L475)

#### Inherited from

`Tables.sla_expected_end_at`

***

### sla\_last\_paused\_at

> **sla\_last\_paused\_at**: `string` \| `null`

Defined in: [app/admin/types.ts:476](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L476)

#### Inherited from

`Tables.sla_last_paused_at`

***

### sla\_pause\_reason

> **sla\_pause\_reason**: `string` \| `null`

Defined in: [app/admin/types.ts:477](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L477)

#### Inherited from

`Tables.sla_pause_reason`

***

### sla\_start\_at

> **sla\_start\_at**: `string` \| `null`

Defined in: [app/admin/types.ts:478](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L478)

#### Inherited from

`Tables.sla_start_at`

***

### sla\_status

> **sla\_status**: `"running"` \| `"paused"` \| `"breached"` \| `"completed"` \| `null`

Defined in: [app/admin/types.ts:479](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L479)

#### Inherited from

`Tables.sla_status`

***

### sla\_total\_paused\_duration

> **sla\_total\_paused\_duration**: `unknown`

Defined in: [app/admin/types.ts:480](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L480)

#### Inherited from

`Tables.sla_total_paused_duration`

***

### solution

> **solution**: `string` \| `null`

Defined in: [app/admin/types.ts:481](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L481)

#### Inherited from

`Tables.solution`

***

### status

> **status**: `string` \| `null`

Defined in: [app/admin/types.ts:482](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L482)

#### Inherited from

`Tables.status`

***

### ticket\_code

> **ticket\_code**: `string` \| `null`

Defined in: [app/admin/types.ts:483](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L483)

#### Inherited from

`Tables.ticket_code`

***

### ticket\_type

> **ticket\_type**: `"INC"` \| `"REQ"` \| `null`

Defined in: [app/admin/types.ts:484](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L484)

#### Inherited from

`Tables.ticket_type`

***

### total\_hold\_time

> **total\_hold\_time**: `unknown`

Defined in: [app/admin/types.ts:485](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L485)

#### Inherited from

`Tables.total_hold_time`

***

### updated\_at

> **updated\_at**: `string` \| `null`

Defined in: [app/admin/types.ts:486](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L486)

#### Inherited from

`Tables.updated_at`

***

### user\_id

> **user\_id**: `string`

Defined in: [app/admin/types.ts:487](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L487)

#### Inherited from

`Tables.user_id`

***

### users

> **users**: \{ `area`: `string` \| `null`; `full_name`: `string`; \} \| `null`

Defined in: [app/admin/admin.types.ts:4](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/admin.types.ts#L4)
