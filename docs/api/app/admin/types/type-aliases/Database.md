[**Mesa de Soporte Técnico - API Documentation**](../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../modules.md) / [app/admin/types](../README.md) / Database

# Type Alias: Database

> **Database** = `object`

Defined in: [app/admin/types.ts:9](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L9)

## Properties

### \_\_InternalSupabase

> **\_\_InternalSupabase**: `object`

Defined in: [app/admin/types.ts:12](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L12)

#### PostgrestVersion

> **PostgrestVersion**: `"13.0.5"`

***

### public

> **public**: `object`

Defined in: [app/admin/types.ts:15](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L15)

#### CompositeTypes

> **CompositeTypes**: `{ [_ in never]: never }`

#### Enums

> **Enums**: `object`

##### Enums.audit\_action\_type\_enum

> **audit\_action\_type\_enum**: `"CREATED"` \| `"STATUS_CHANGE"` \| `"PAUSED"` \| `"RESUMED"` \| `"COMMENT_ADDED"` \| `"RECLASSIFIED"`

##### Enums.sla\_status\_enum

> **sla\_status\_enum**: `"running"` \| `"paused"` \| `"breached"` \| `"completed"`

##### Enums.ticket\_type\_enum

> **ticket\_type\_enum**: `"INC"` \| `"REQ"`

#### Functions

> **Functions**: `object`

##### Functions.calculate\_deadline

> **calculate\_deadline**: `object`

##### Functions.calculate\_deadline.Args

> **Args**: `object`

##### Functions.calculate\_deadline.Args.p\_hours

> **p\_hours**: `number`

##### Functions.calculate\_deadline.Args.p\_start\_time

> **p\_start\_time**: `string`

##### Functions.calculate\_deadline.Returns

> **Returns**: `string`

#### Tables

> **Tables**: `object`

##### Tables.areas

> **areas**: `object`

##### Tables.areas.Insert

> **Insert**: `object`

##### Tables.areas.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.areas.Insert.id?

> `optional` **id**: `number`

##### Tables.areas.Insert.name

> **name**: `string`

##### Tables.areas.Relationships

> **Relationships**: \[\]

##### Tables.areas.Row

> **Row**: `object`

##### Tables.areas.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.areas.Row.id

> **id**: `number`

##### Tables.areas.Row.name

> **name**: `string`

##### Tables.areas.Update

> **Update**: `object`

##### Tables.areas.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.areas.Update.id?

> `optional` **id**: `number`

##### Tables.areas.Update.name?

> `optional` **name**: `string`

##### Tables.asset\_events

> **asset\_events**: `object`

##### Tables.asset\_events.Insert

> **Insert**: `object`

##### Tables.asset\_events.Insert.actor\_id?

> `optional` **actor\_id**: `string` \| `null`

##### Tables.asset\_events.Insert.asset\_serial

> **asset\_serial**: `string`

##### Tables.asset\_events.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.asset\_events.Insert.description?

> `optional` **description**: `string` \| `null`

##### Tables.asset\_events.Insert.event\_type

> **event\_type**: `string`

##### Tables.asset\_events.Insert.id?

> `optional` **id**: `number`

##### Tables.asset\_events.Relationships

> **Relationships**: \[\{ `columns`: \[`"actor_id"`\]; `foreignKeyName`: `"asset_events_actor_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}\]

##### Tables.asset\_events.Row

> **Row**: `object`

##### Tables.asset\_events.Row.actor\_id

> **actor\_id**: `string` \| `null`

##### Tables.asset\_events.Row.asset\_serial

> **asset\_serial**: `string`

##### Tables.asset\_events.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.asset\_events.Row.description

> **description**: `string` \| `null`

##### Tables.asset\_events.Row.event\_type

> **event\_type**: `string`

##### Tables.asset\_events.Row.id

> **id**: `number`

##### Tables.asset\_events.Update

> **Update**: `object`

##### Tables.asset\_events.Update.actor\_id?

> `optional` **actor\_id**: `string` \| `null`

##### Tables.asset\_events.Update.asset\_serial?

> `optional` **asset\_serial**: `string`

##### Tables.asset\_events.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.asset\_events.Update.description?

> `optional` **description**: `string` \| `null`

##### Tables.asset\_events.Update.event\_type?

> `optional` **event\_type**: `string`

##### Tables.asset\_events.Update.id?

> `optional` **id**: `number`

##### Tables.asset\_logs

> **asset\_logs**: `object`

##### Tables.asset\_logs.Insert

> **Insert**: `object`

##### Tables.asset\_logs.Insert.action\_type

> **action\_type**: `string`

##### Tables.asset\_logs.Insert.asset\_id

> **asset\_id**: `number`

##### Tables.asset\_logs.Insert.authorization\_file\_url

> **authorization\_file\_url**: `string`

##### Tables.asset\_logs.Insert.comments?

> `optional` **comments**: `string` \| `null`

##### Tables.asset\_logs.Insert.created\_at?

> `optional` **created\_at**: `string`

##### Tables.asset\_logs.Insert.id?

> `optional` **id**: `string`

##### Tables.asset\_logs.Insert.new\_user\_id?

> `optional` **new\_user\_id**: `string` \| `null`

##### Tables.asset\_logs.Insert.performed\_by\_user\_id

> **performed\_by\_user\_id**: `string`

##### Tables.asset\_logs.Insert.previous\_user\_id?

> `optional` **previous\_user\_id**: `string` \| `null`

##### Tables.asset\_logs.Relationships

> **Relationships**: \[\{ `columns`: \[`"asset_id"`\]; `foreignKeyName`: `"asset_logs_asset_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"assets"`; \}, \{ `columns`: \[`"new_user_id"`\]; `foreignKeyName`: `"asset_logs_new_user_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}, \{ `columns`: \[`"performed_by_user_id"`\]; `foreignKeyName`: `"asset_logs_performed_by_user_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}, \{ `columns`: \[`"previous_user_id"`\]; `foreignKeyName`: `"asset_logs_previous_user_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}\]

##### Tables.asset\_logs.Row

> **Row**: `object`

##### Tables.asset\_logs.Row.action\_type

> **action\_type**: `string`

##### Tables.asset\_logs.Row.asset\_id

> **asset\_id**: `number`

##### Tables.asset\_logs.Row.authorization\_file\_url

> **authorization\_file\_url**: `string`

##### Tables.asset\_logs.Row.comments

> **comments**: `string` \| `null`

##### Tables.asset\_logs.Row.created\_at

> **created\_at**: `string`

##### Tables.asset\_logs.Row.id

> **id**: `string`

##### Tables.asset\_logs.Row.new\_user\_id

> **new\_user\_id**: `string` \| `null`

##### Tables.asset\_logs.Row.performed\_by\_user\_id

> **performed\_by\_user\_id**: `string`

##### Tables.asset\_logs.Row.previous\_user\_id

> **previous\_user\_id**: `string` \| `null`

##### Tables.asset\_logs.Update

> **Update**: `object`

##### Tables.asset\_logs.Update.action\_type?

> `optional` **action\_type**: `string`

##### Tables.asset\_logs.Update.asset\_id?

> `optional` **asset\_id**: `number`

##### Tables.asset\_logs.Update.authorization\_file\_url?

> `optional` **authorization\_file\_url**: `string`

##### Tables.asset\_logs.Update.comments?

> `optional` **comments**: `string` \| `null`

##### Tables.asset\_logs.Update.created\_at?

> `optional` **created\_at**: `string`

##### Tables.asset\_logs.Update.id?

> `optional` **id**: `string`

##### Tables.asset\_logs.Update.new\_user\_id?

> `optional` **new\_user\_id**: `string` \| `null`

##### Tables.asset\_logs.Update.performed\_by\_user\_id?

> `optional` **performed\_by\_user\_id**: `string`

##### Tables.asset\_logs.Update.previous\_user\_id?

> `optional` **previous\_user\_id**: `string` \| `null`

##### Tables.assets

> **assets**: `object`

##### Tables.assets.Insert

> **Insert**: `object`

##### Tables.assets.Insert.assigned\_to\_user\_id?

> `optional` **assigned\_to\_user\_id**: `string` \| `null`

##### Tables.assets.Insert.brand?

> `optional` **brand**: `string` \| `null`

##### Tables.assets.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.assets.Insert.id?

> `optional` **id**: `number`

##### Tables.assets.Insert.location?

> `optional` **location**: `string` \| `null`

##### Tables.assets.Insert.model?

> `optional` **model**: `string` \| `null`

##### Tables.assets.Insert.serial\_number

> **serial\_number**: `string`

##### Tables.assets.Insert.type?

> `optional` **type**: `string` \| `null`

##### Tables.assets.Relationships

> **Relationships**: \[\{ `columns`: \[`"assigned_to_user_id"`\]; `foreignKeyName`: `"assets_assigned_to_user_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}\]

##### Tables.assets.Row

> **Row**: `object`

##### Tables.assets.Row.assigned\_to\_user\_id

> **assigned\_to\_user\_id**: `string` \| `null`

##### Tables.assets.Row.brand

> **brand**: `string` \| `null`

##### Tables.assets.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.assets.Row.id

> **id**: `number`

##### Tables.assets.Row.location

> **location**: `string` \| `null`

##### Tables.assets.Row.model

> **model**: `string` \| `null`

##### Tables.assets.Row.serial\_number

> **serial\_number**: `string`

##### Tables.assets.Row.type

> **type**: `string` \| `null`

##### Tables.assets.Update

> **Update**: `object`

##### Tables.assets.Update.assigned\_to\_user\_id?

> `optional` **assigned\_to\_user\_id**: `string` \| `null`

##### Tables.assets.Update.brand?

> `optional` **brand**: `string` \| `null`

##### Tables.assets.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.assets.Update.id?

> `optional` **id**: `number`

##### Tables.assets.Update.location?

> `optional` **location**: `string` \| `null`

##### Tables.assets.Update.model?

> `optional` **model**: `string` \| `null`

##### Tables.assets.Update.serial\_number?

> `optional` **serial\_number**: `string`

##### Tables.assets.Update.type?

> `optional` **type**: `string` \| `null`

##### Tables.audit\_logs

> **audit\_logs**: `object`

##### Tables.audit\_logs.Insert

> **Insert**: `object`

##### Tables.audit\_logs.Insert.action

> **action**: `string`

##### Tables.audit\_logs.Insert.actor\_id?

> `optional` **actor\_id**: `string` \| `null`

##### Tables.audit\_logs.Insert.created\_at?

> `optional` **created\_at**: `string`

##### Tables.audit\_logs.Insert.details?

> `optional` **details**: [`Json`](Json.md) \| `null`

##### Tables.audit\_logs.Insert.id?

> `optional` **id**: `string`

##### Tables.audit\_logs.Insert.ip\_address?

> `optional` **ip\_address**: `string` \| `null`

##### Tables.audit\_logs.Insert.resource?

> `optional` **resource**: `string` \| `null`

##### Tables.audit\_logs.Insert.resource\_id?

> `optional` **resource\_id**: `string` \| `null`

##### Tables.audit\_logs.Relationships

> **Relationships**: \[\{ `columns`: \[`"actor_id"`\]; `foreignKeyName`: `"audit_logs_actor_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}\]

##### Tables.audit\_logs.Row

> **Row**: `object`

##### Tables.audit\_logs.Row.action

> **action**: `string`

##### Tables.audit\_logs.Row.actor\_id

> **actor\_id**: `string` \| `null`

##### Tables.audit\_logs.Row.created\_at

> **created\_at**: `string`

##### Tables.audit\_logs.Row.details

> **details**: [`Json`](Json.md) \| `null`

##### Tables.audit\_logs.Row.id

> **id**: `string`

##### Tables.audit\_logs.Row.ip\_address

> **ip\_address**: `string` \| `null`

##### Tables.audit\_logs.Row.resource

> **resource**: `string` \| `null`

##### Tables.audit\_logs.Row.resource\_id

> **resource\_id**: `string` \| `null`

##### Tables.audit\_logs.Update

> **Update**: `object`

##### Tables.audit\_logs.Update.action?

> `optional` **action**: `string`

##### Tables.audit\_logs.Update.actor\_id?

> `optional` **actor\_id**: `string` \| `null`

##### Tables.audit\_logs.Update.created\_at?

> `optional` **created\_at**: `string`

##### Tables.audit\_logs.Update.details?

> `optional` **details**: [`Json`](Json.md) \| `null`

##### Tables.audit\_logs.Update.id?

> `optional` **id**: `string`

##### Tables.audit\_logs.Update.ip\_address?

> `optional` **ip\_address**: `string` \| `null`

##### Tables.audit\_logs.Update.resource?

> `optional` **resource**: `string` \| `null`

##### Tables.audit\_logs.Update.resource\_id?

> `optional` **resource\_id**: `string` \| `null`

##### Tables.categories

> **categories**: `object`

##### Tables.categories.Insert

> **Insert**: `object`

##### Tables.categories.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.categories.Insert.id?

> `optional` **id**: `number`

##### Tables.categories.Insert.name

> **name**: `string`

##### Tables.categories.Relationships

> **Relationships**: \[\]

##### Tables.categories.Row

> **Row**: `object`

##### Tables.categories.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.categories.Row.id

> **id**: `number`

##### Tables.categories.Row.name

> **name**: `string`

##### Tables.categories.Update

> **Update**: `object`

##### Tables.categories.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.categories.Update.id?

> `optional` **id**: `number`

##### Tables.categories.Update.name?

> `optional` **name**: `string`

##### Tables.mass\_outages

> **mass\_outages**: `object`

##### Tables.mass\_outages.Insert

> **Insert**: `object`

##### Tables.mass\_outages.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.mass\_outages.Insert.created\_by?

> `optional` **created\_by**: `string` \| `null`

##### Tables.mass\_outages.Insert.description?

> `optional` **description**: `string` \| `null`

##### Tables.mass\_outages.Insert.id?

> `optional` **id**: `number`

##### Tables.mass\_outages.Insert.is\_active?

> `optional` **is\_active**: `boolean` \| `null`

##### Tables.mass\_outages.Insert.location\_scope

> **location\_scope**: `string`

##### Tables.mass\_outages.Insert.title

> **title**: `string`

##### Tables.mass\_outages.Relationships

> **Relationships**: \[\{ `columns`: \[`"created_by"`\]; `foreignKeyName`: `"mass_outages_created_by_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}\]

##### Tables.mass\_outages.Row

> **Row**: `object`

##### Tables.mass\_outages.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.mass\_outages.Row.created\_by

> **created\_by**: `string` \| `null`

##### Tables.mass\_outages.Row.description

> **description**: `string` \| `null`

##### Tables.mass\_outages.Row.id

> **id**: `number`

##### Tables.mass\_outages.Row.is\_active

> **is\_active**: `boolean` \| `null`

##### Tables.mass\_outages.Row.location\_scope

> **location\_scope**: `string`

##### Tables.mass\_outages.Row.title

> **title**: `string`

##### Tables.mass\_outages.Update

> **Update**: `object`

##### Tables.mass\_outages.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.mass\_outages.Update.created\_by?

> `optional` **created\_by**: `string` \| `null`

##### Tables.mass\_outages.Update.description?

> `optional` **description**: `string` \| `null`

##### Tables.mass\_outages.Update.id?

> `optional` **id**: `number`

##### Tables.mass\_outages.Update.is\_active?

> `optional` **is\_active**: `boolean` \| `null`

##### Tables.mass\_outages.Update.location\_scope?

> `optional` **location\_scope**: `string`

##### Tables.mass\_outages.Update.title?

> `optional` **title**: `string`

##### Tables.outage\_reports

> **outage\_reports**: `object`

##### Tables.outage\_reports.Insert

> **Insert**: `object`

##### Tables.outage\_reports.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.outage\_reports.Insert.id?

> `optional` **id**: `number`

##### Tables.outage\_reports.Insert.location

> **location**: `string`

##### Tables.outage\_reports.Insert.reported\_by?

> `optional` **reported\_by**: `string` \| `null`

##### Tables.outage\_reports.Relationships

> **Relationships**: \[\{ `columns`: \[`"reported_by"`\]; `foreignKeyName`: `"outage_reports_reported_by_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}\]

##### Tables.outage\_reports.Row

> **Row**: `object`

##### Tables.outage\_reports.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.outage\_reports.Row.id

> **id**: `number`

##### Tables.outage\_reports.Row.location

> **location**: `string`

##### Tables.outage\_reports.Row.reported\_by

> **reported\_by**: `string` \| `null`

##### Tables.outage\_reports.Update

> **Update**: `object`

##### Tables.outage\_reports.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.outage\_reports.Update.id?

> `optional` **id**: `number`

##### Tables.outage\_reports.Update.location?

> `optional` **location**: `string`

##### Tables.outage\_reports.Update.reported\_by?

> `optional` **reported\_by**: `string` \| `null`

##### Tables.pause\_reasons

> **pause\_reasons**: `object`

##### Tables.pause\_reasons.Insert

> **Insert**: `object`

##### Tables.pause\_reasons.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.pause\_reasons.Insert.id?

> `optional` **id**: `number`

##### Tables.pause\_reasons.Insert.is\_active?

> `optional` **is\_active**: `boolean` \| `null`

##### Tables.pause\_reasons.Insert.reason\_text

> **reason\_text**: `string`

##### Tables.pause\_reasons.Relationships

> **Relationships**: \[\]

##### Tables.pause\_reasons.Row

> **Row**: `object`

##### Tables.pause\_reasons.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.pause\_reasons.Row.id

> **id**: `number`

##### Tables.pause\_reasons.Row.is\_active

> **is\_active**: `boolean` \| `null`

##### Tables.pause\_reasons.Row.reason\_text

> **reason\_text**: `string`

##### Tables.pause\_reasons.Update

> **Update**: `object`

##### Tables.pause\_reasons.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.pause\_reasons.Update.id?

> `optional` **id**: `number`

##### Tables.pause\_reasons.Update.is\_active?

> `optional` **is\_active**: `boolean` \| `null`

##### Tables.pause\_reasons.Update.reason\_text?

> `optional` **reason\_text**: `string`

##### Tables.reservations

> **reservations**: `object`

##### Tables.reservations.Insert

> **Insert**: `object`

##### Tables.reservations.Insert.auditorium\_id?

> `optional` **auditorium\_id**: `string` \| `null`

##### Tables.reservations.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.reservations.Insert.end\_time

> **end\_time**: `string`

##### Tables.reservations.Insert.id?

> `optional` **id**: `number`

##### Tables.reservations.Insert.resources?

> `optional` **resources**: `string`[] \| `null`

##### Tables.reservations.Insert.start\_time

> **start\_time**: `string`

##### Tables.reservations.Insert.status?

> `optional` **status**: `string`

##### Tables.reservations.Insert.title

> **title**: `string`

##### Tables.reservations.Insert.user\_id?

> `optional` **user\_id**: `string` \| `null`

##### Tables.reservations.Relationships

> **Relationships**: \[\{ `columns`: \[`"user_id"`\]; `foreignKeyName`: `"reservations_user_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}\]

##### Tables.reservations.Row

> **Row**: `object`

##### Tables.reservations.Row.auditorium\_id

> **auditorium\_id**: `string` \| `null`

##### Tables.reservations.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.reservations.Row.end\_time

> **end\_time**: `string`

##### Tables.reservations.Row.id

> **id**: `number`

##### Tables.reservations.Row.resources

> **resources**: `string`[] \| `null`

##### Tables.reservations.Row.start\_time

> **start\_time**: `string`

##### Tables.reservations.Row.status

> **status**: `string`

##### Tables.reservations.Row.title

> **title**: `string`

##### Tables.reservations.Row.user\_id

> **user\_id**: `string` \| `null`

##### Tables.reservations.Update

> **Update**: `object`

##### Tables.reservations.Update.auditorium\_id?

> `optional` **auditorium\_id**: `string` \| `null`

##### Tables.reservations.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.reservations.Update.end\_time?

> `optional` **end\_time**: `string`

##### Tables.reservations.Update.id?

> `optional` **id**: `number`

##### Tables.reservations.Update.resources?

> `optional` **resources**: `string`[] \| `null`

##### Tables.reservations.Update.start\_time?

> `optional` **start\_time**: `string`

##### Tables.reservations.Update.status?

> `optional` **status**: `string`

##### Tables.reservations.Update.title?

> `optional` **title**: `string`

##### Tables.reservations.Update.user\_id?

> `optional` **user\_id**: `string` \| `null`

##### Tables.system\_settings

> **system\_settings**: `object`

##### Tables.system\_settings.Insert

> **Insert**: `object`

##### Tables.system\_settings.Insert.key

> **key**: `string`

##### Tables.system\_settings.Insert.updated\_at?

> `optional` **updated\_at**: `string` \| `null`

##### Tables.system\_settings.Insert.value?

> `optional` **value**: [`Json`](Json.md) \| `null`

##### Tables.system\_settings.Relationships

> **Relationships**: \[\]

##### Tables.system\_settings.Row

> **Row**: `object`

##### Tables.system\_settings.Row.key

> **key**: `string`

##### Tables.system\_settings.Row.updated\_at

> **updated\_at**: `string` \| `null`

##### Tables.system\_settings.Row.value

> **value**: [`Json`](Json.md) \| `null`

##### Tables.system\_settings.Update

> **Update**: `object`

##### Tables.system\_settings.Update.key?

> `optional` **key**: `string`

##### Tables.system\_settings.Update.updated\_at?

> `optional` **updated\_at**: `string` \| `null`

##### Tables.system\_settings.Update.value?

> `optional` **value**: [`Json`](Json.md) \| `null`

##### Tables.ticket\_categories\_config

> **ticket\_categories\_config**: `object`

##### Tables.ticket\_categories\_config.Insert

> **Insert**: `object`

##### Tables.ticket\_categories\_config.Insert.id?

> `optional` **id**: `number`

##### Tables.ticket\_categories\_config.Insert.internal\_type

> **internal\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"ticket_type_enum"`\]

##### Tables.ticket\_categories\_config.Insert.is\_active?

> `optional` **is\_active**: `boolean` \| `null`

##### Tables.ticket\_categories\_config.Insert.priority\_level?

> `optional` **priority\_level**: `string` \| `null`

##### Tables.ticket\_categories\_config.Insert.sla\_hours\_std?

> `optional` **sla\_hours\_std**: `number` \| `null`

##### Tables.ticket\_categories\_config.Insert.sla\_hours\_vip?

> `optional` **sla\_hours\_vip**: `number` \| `null`

##### Tables.ticket\_categories\_config.Insert.user\_selection\_text

> **user\_selection\_text**: `string`

##### Tables.ticket\_categories\_config.Relationships

> **Relationships**: \[\]

##### Tables.ticket\_categories\_config.Row

> **Row**: `object`

##### Tables.ticket\_categories\_config.Row.id

> **id**: `number`

##### Tables.ticket\_categories\_config.Row.internal\_type

> **internal\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"ticket_type_enum"`\]

##### Tables.ticket\_categories\_config.Row.is\_active

> **is\_active**: `boolean` \| `null`

##### Tables.ticket\_categories\_config.Row.priority\_level

> **priority\_level**: `string` \| `null`

##### Tables.ticket\_categories\_config.Row.sla\_hours\_std

> **sla\_hours\_std**: `number` \| `null`

##### Tables.ticket\_categories\_config.Row.sla\_hours\_vip

> **sla\_hours\_vip**: `number` \| `null`

##### Tables.ticket\_categories\_config.Row.user\_selection\_text

> **user\_selection\_text**: `string`

##### Tables.ticket\_categories\_config.Update

> **Update**: `object`

##### Tables.ticket\_categories\_config.Update.id?

> `optional` **id**: `number`

##### Tables.ticket\_categories\_config.Update.internal\_type?

> `optional` **internal\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"ticket_type_enum"`\]

##### Tables.ticket\_categories\_config.Update.is\_active?

> `optional` **is\_active**: `boolean` \| `null`

##### Tables.ticket\_categories\_config.Update.priority\_level?

> `optional` **priority\_level**: `string` \| `null`

##### Tables.ticket\_categories\_config.Update.sla\_hours\_std?

> `optional` **sla\_hours\_std**: `number` \| `null`

##### Tables.ticket\_categories\_config.Update.sla\_hours\_vip?

> `optional` **sla\_hours\_vip**: `number` \| `null`

##### Tables.ticket\_categories\_config.Update.user\_selection\_text?

> `optional` **user\_selection\_text**: `string`

##### Tables.ticket\_events

> **ticket\_events**: `object`

##### Tables.ticket\_events.Insert

> **Insert**: `object`

##### Tables.ticket\_events.Insert.action\_type

> **action\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"audit_action_type_enum"`\]

##### Tables.ticket\_events.Insert.actor\_id?

> `optional` **actor\_id**: `string` \| `null`

##### Tables.ticket\_events.Insert.comment?

> `optional` **comment**: `string` \| `null`

##### Tables.ticket\_events.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.ticket\_events.Insert.id?

> `optional` **id**: `number`

##### Tables.ticket\_events.Insert.new\_value?

> `optional` **new\_value**: `string` \| `null`

##### Tables.ticket\_events.Insert.old\_value?

> `optional` **old\_value**: `string` \| `null`

##### Tables.ticket\_events.Insert.ticket\_id?

> `optional` **ticket\_id**: `number` \| `null`

##### Tables.ticket\_events.Relationships

> **Relationships**: \[\{ `columns`: \[`"actor_id"`\]; `foreignKeyName`: `"ticket_events_actor_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}, \{ `columns`: \[`"ticket_id"`\]; `foreignKeyName`: `"ticket_events_ticket_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"tickets"`; \}\]

##### Tables.ticket\_events.Row

> **Row**: `object`

##### Tables.ticket\_events.Row.action\_type

> **action\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"audit_action_type_enum"`\]

##### Tables.ticket\_events.Row.actor\_id

> **actor\_id**: `string` \| `null`

##### Tables.ticket\_events.Row.comment

> **comment**: `string` \| `null`

##### Tables.ticket\_events.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.ticket\_events.Row.id

> **id**: `number`

##### Tables.ticket\_events.Row.new\_value

> **new\_value**: `string` \| `null`

##### Tables.ticket\_events.Row.old\_value

> **old\_value**: `string` \| `null`

##### Tables.ticket\_events.Row.ticket\_id

> **ticket\_id**: `number` \| `null`

##### Tables.ticket\_events.Update

> **Update**: `object`

##### Tables.ticket\_events.Update.action\_type?

> `optional` **action\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"audit_action_type_enum"`\]

##### Tables.ticket\_events.Update.actor\_id?

> `optional` **actor\_id**: `string` \| `null`

##### Tables.ticket\_events.Update.comment?

> `optional` **comment**: `string` \| `null`

##### Tables.ticket\_events.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.ticket\_events.Update.id?

> `optional` **id**: `number`

##### Tables.ticket\_events.Update.new\_value?

> `optional` **new\_value**: `string` \| `null`

##### Tables.ticket\_events.Update.old\_value?

> `optional` **old\_value**: `string` \| `null`

##### Tables.ticket\_events.Update.ticket\_id?

> `optional` **ticket\_id**: `number` \| `null`

##### Tables.tickets

> **tickets**: `object`

##### Tables.tickets.Insert

> **Insert**: `object`

##### Tables.tickets.Insert.asset\_serial?

> `optional` **asset\_serial**: `string` \| `null`

##### Tables.tickets.Insert.assigned\_agent\_id?

> `optional` **assigned\_agent\_id**: `string` \| `null`

##### Tables.tickets.Insert.category?

> `optional` **category**: `string` \| `null`

##### Tables.tickets.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.tickets.Insert.description?

> `optional` **description**: `string` \| `null`

##### Tables.tickets.Insert.hold\_reason?

> `optional` **hold\_reason**: `string` \| `null`

##### Tables.tickets.Insert.id?

> `optional` **id**: `number`

##### Tables.tickets.Insert.is\_vip\_ticket?

> `optional` **is\_vip\_ticket**: `boolean` \| `null`

##### Tables.tickets.Insert.location

> **location**: `string`

##### Tables.tickets.Insert.sla\_clock\_stopped\_at?

> `optional` **sla\_clock\_stopped\_at**: `string` \| `null`

##### Tables.tickets.Insert.sla\_expected\_end\_at?

> `optional` **sla\_expected\_end\_at**: `string` \| `null`

##### Tables.tickets.Insert.sla\_last\_paused\_at?

> `optional` **sla\_last\_paused\_at**: `string` \| `null`

##### Tables.tickets.Insert.sla\_pause\_reason?

> `optional` **sla\_pause\_reason**: `string` \| `null`

##### Tables.tickets.Insert.sla\_start\_at?

> `optional` **sla\_start\_at**: `string` \| `null`

##### Tables.tickets.Insert.sla\_status?

> `optional` **sla\_status**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"sla_status_enum"`\] \| `null`

##### Tables.tickets.Insert.sla\_total\_paused\_duration?

> `optional` **sla\_total\_paused\_duration**: `unknown`

##### Tables.tickets.Insert.solution?

> `optional` **solution**: `string` \| `null`

##### Tables.tickets.Insert.status?

> `optional` **status**: `string` \| `null`

##### Tables.tickets.Insert.ticket\_code?

> `optional` **ticket\_code**: `string` \| `null`

##### Tables.tickets.Insert.ticket\_type?

> `optional` **ticket\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"ticket_type_enum"`\] \| `null`

##### Tables.tickets.Insert.total\_hold\_time?

> `optional` **total\_hold\_time**: `unknown`

##### Tables.tickets.Insert.updated\_at?

> `optional` **updated\_at**: `string` \| `null`

##### Tables.tickets.Insert.user\_id

> **user\_id**: `string`

##### Tables.tickets.Relationships

> **Relationships**: \[\{ `columns`: \[`"asset_serial"`\]; `foreignKeyName`: `"tickets_asset_serial_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"serial_number"`\]; `referencedRelation`: `"assets"`; \}, \{ `columns`: \[`"assigned_agent_id"`\]; `foreignKeyName`: `"tickets_assigned_agent_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}, \{ `columns`: \[`"user_id"`\]; `foreignKeyName`: `"tickets_user_id_fkey"`; `isOneToOne`: `false`; `referencedColumns`: \[`"id"`\]; `referencedRelation`: `"users"`; \}\]

##### Tables.tickets.Row

> **Row**: `object`

##### Tables.tickets.Row.asset\_serial

> **asset\_serial**: `string` \| `null`

##### Tables.tickets.Row.assigned\_agent\_id

> **assigned\_agent\_id**: `string` \| `null`

##### Tables.tickets.Row.category

> **category**: `string` \| `null`

##### Tables.tickets.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.tickets.Row.description

> **description**: `string` \| `null`

##### Tables.tickets.Row.hold\_reason

> **hold\_reason**: `string` \| `null`

##### Tables.tickets.Row.id

> **id**: `number`

##### Tables.tickets.Row.is\_vip\_ticket

> **is\_vip\_ticket**: `boolean` \| `null`

##### Tables.tickets.Row.location

> **location**: `string`

##### Tables.tickets.Row.sla\_clock\_stopped\_at

> **sla\_clock\_stopped\_at**: `string` \| `null`

##### Tables.tickets.Row.sla\_expected\_end\_at

> **sla\_expected\_end\_at**: `string` \| `null`

##### Tables.tickets.Row.sla\_last\_paused\_at

> **sla\_last\_paused\_at**: `string` \| `null`

##### Tables.tickets.Row.sla\_pause\_reason

> **sla\_pause\_reason**: `string` \| `null`

##### Tables.tickets.Row.sla\_start\_at

> **sla\_start\_at**: `string` \| `null`

##### Tables.tickets.Row.sla\_status

> **sla\_status**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"sla_status_enum"`\] \| `null`

##### Tables.tickets.Row.sla\_total\_paused\_duration

> **sla\_total\_paused\_duration**: `unknown`

##### Tables.tickets.Row.solution

> **solution**: `string` \| `null`

##### Tables.tickets.Row.status

> **status**: `string` \| `null`

##### Tables.tickets.Row.ticket\_code

> **ticket\_code**: `string` \| `null`

##### Tables.tickets.Row.ticket\_type

> **ticket\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"ticket_type_enum"`\] \| `null`

##### Tables.tickets.Row.total\_hold\_time

> **total\_hold\_time**: `unknown`

##### Tables.tickets.Row.updated\_at

> **updated\_at**: `string` \| `null`

##### Tables.tickets.Row.user\_id

> **user\_id**: `string`

##### Tables.tickets.Update

> **Update**: `object`

##### Tables.tickets.Update.asset\_serial?

> `optional` **asset\_serial**: `string` \| `null`

##### Tables.tickets.Update.assigned\_agent\_id?

> `optional` **assigned\_agent\_id**: `string` \| `null`

##### Tables.tickets.Update.category?

> `optional` **category**: `string` \| `null`

##### Tables.tickets.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.tickets.Update.description?

> `optional` **description**: `string` \| `null`

##### Tables.tickets.Update.hold\_reason?

> `optional` **hold\_reason**: `string` \| `null`

##### Tables.tickets.Update.id?

> `optional` **id**: `number`

##### Tables.tickets.Update.is\_vip\_ticket?

> `optional` **is\_vip\_ticket**: `boolean` \| `null`

##### Tables.tickets.Update.location?

> `optional` **location**: `string`

##### Tables.tickets.Update.sla\_clock\_stopped\_at?

> `optional` **sla\_clock\_stopped\_at**: `string` \| `null`

##### Tables.tickets.Update.sla\_expected\_end\_at?

> `optional` **sla\_expected\_end\_at**: `string` \| `null`

##### Tables.tickets.Update.sla\_last\_paused\_at?

> `optional` **sla\_last\_paused\_at**: `string` \| `null`

##### Tables.tickets.Update.sla\_pause\_reason?

> `optional` **sla\_pause\_reason**: `string` \| `null`

##### Tables.tickets.Update.sla\_start\_at?

> `optional` **sla\_start\_at**: `string` \| `null`

##### Tables.tickets.Update.sla\_status?

> `optional` **sla\_status**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"sla_status_enum"`\] \| `null`

##### Tables.tickets.Update.sla\_total\_paused\_duration?

> `optional` **sla\_total\_paused\_duration**: `unknown`

##### Tables.tickets.Update.solution?

> `optional` **solution**: `string` \| `null`

##### Tables.tickets.Update.status?

> `optional` **status**: `string` \| `null`

##### Tables.tickets.Update.ticket\_code?

> `optional` **ticket\_code**: `string` \| `null`

##### Tables.tickets.Update.ticket\_type?

> `optional` **ticket\_type**: `Database`\[`"public"`\]\[`"Enums"`\]\[`"ticket_type_enum"`\] \| `null`

##### Tables.tickets.Update.total\_hold\_time?

> `optional` **total\_hold\_time**: `unknown`

##### Tables.tickets.Update.updated\_at?

> `optional` **updated\_at**: `string` \| `null`

##### Tables.tickets.Update.user\_id?

> `optional` **user\_id**: `string`

##### Tables.users

> **users**: `object`

##### Tables.users.Insert

> **Insert**: `object`

##### Tables.users.Insert.area?

> `optional` **area**: `string` \| `null`

##### Tables.users.Insert.auth\_id?

> `optional` **auth\_id**: `string` \| `null`

##### Tables.users.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.users.Insert.deleted\_at?

> `optional` **deleted\_at**: `string` \| `null`

##### Tables.users.Insert.email?

> `optional` **email**: `string` \| `null`

##### Tables.users.Insert.employment\_type?

> `optional` **employment\_type**: `string` \| `null`

##### Tables.users.Insert.full\_name

> **full\_name**: `string`

##### Tables.users.Insert.id?

> `optional` **id**: `string`

##### Tables.users.Insert.is\_active?

> `optional` **is\_active**: `boolean` \| `null`

##### Tables.users.Insert.is\_vip?

> `optional` **is\_vip**: `boolean` \| `null`

##### Tables.users.Insert.job\_category?

> `optional` **job\_category**: `string` \| `null`

##### Tables.users.Insert.password?

> `optional` **password**: `string` \| `null`

##### Tables.users.Insert.perm\_create\_assets?

> `optional` **perm\_create\_assets**: `boolean` \| `null`

##### Tables.users.Insert.perm\_decommission\_assets?

> `optional` **perm\_decommission\_assets**: `boolean` \| `null`

##### Tables.users.Insert.perm\_transfer\_assets?

> `optional` **perm\_transfer\_assets**: `boolean` \| `null`

##### Tables.users.Insert.role?

> `optional` **role**: `string` \| `null`

##### Tables.users.Insert.updated\_at?

> `optional` **updated\_at**: `string` \| `null`

##### Tables.users.Insert.username

> **username**: `string`

##### Tables.users.Relationships

> **Relationships**: \[\]

##### Tables.users.Row

> **Row**: `object`

##### Tables.users.Row.area

> **area**: `string` \| `null`

##### Tables.users.Row.auth\_id

> **auth\_id**: `string` \| `null`

##### Tables.users.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.users.Row.deleted\_at

> **deleted\_at**: `string` \| `null`

##### Tables.users.Row.email

> **email**: `string` \| `null`

##### Tables.users.Row.employment\_type

> **employment\_type**: `string` \| `null`

##### Tables.users.Row.full\_name

> **full\_name**: `string`

##### Tables.users.Row.id

> **id**: `string`

##### Tables.users.Row.is\_active

> **is\_active**: `boolean` \| `null`

##### Tables.users.Row.is\_vip

> **is\_vip**: `boolean` \| `null`

##### Tables.users.Row.job\_category

> **job\_category**: `string` \| `null`

##### Tables.users.Row.password

> **password**: `string` \| `null`

##### Tables.users.Row.perm\_create\_assets

> **perm\_create\_assets**: `boolean` \| `null`

##### Tables.users.Row.perm\_decommission\_assets

> **perm\_decommission\_assets**: `boolean` \| `null`

##### Tables.users.Row.perm\_transfer\_assets

> **perm\_transfer\_assets**: `boolean` \| `null`

##### Tables.users.Row.role

> **role**: `string` \| `null`

##### Tables.users.Row.updated\_at

> **updated\_at**: `string` \| `null`

##### Tables.users.Row.username

> **username**: `string`

##### Tables.users.Update

> **Update**: `object`

##### Tables.users.Update.area?

> `optional` **area**: `string` \| `null`

##### Tables.users.Update.auth\_id?

> `optional` **auth\_id**: `string` \| `null`

##### Tables.users.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.users.Update.deleted\_at?

> `optional` **deleted\_at**: `string` \| `null`

##### Tables.users.Update.email?

> `optional` **email**: `string` \| `null`

##### Tables.users.Update.employment\_type?

> `optional` **employment\_type**: `string` \| `null`

##### Tables.users.Update.full\_name?

> `optional` **full\_name**: `string`

##### Tables.users.Update.id?

> `optional` **id**: `string`

##### Tables.users.Update.is\_active?

> `optional` **is\_active**: `boolean` \| `null`

##### Tables.users.Update.is\_vip?

> `optional` **is\_vip**: `boolean` \| `null`

##### Tables.users.Update.job\_category?

> `optional` **job\_category**: `string` \| `null`

##### Tables.users.Update.password?

> `optional` **password**: `string` \| `null`

##### Tables.users.Update.perm\_create\_assets?

> `optional` **perm\_create\_assets**: `boolean` \| `null`

##### Tables.users.Update.perm\_decommission\_assets?

> `optional` **perm\_decommission\_assets**: `boolean` \| `null`

##### Tables.users.Update.perm\_transfer\_assets?

> `optional` **perm\_transfer\_assets**: `boolean` \| `null`

##### Tables.users.Update.role?

> `optional` **role**: `string` \| `null`

##### Tables.users.Update.updated\_at?

> `optional` **updated\_at**: `string` \| `null`

##### Tables.users.Update.username?

> `optional` **username**: `string`

##### Tables.weekly\_schedules

> **weekly\_schedules**: `object`

##### Tables.weekly\_schedules.Insert

> **Insert**: `object`

##### Tables.weekly\_schedules.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.weekly\_schedules.Insert.id?

> `optional` **id**: `number`

##### Tables.weekly\_schedules.Insert.overtime\_hours?

> `optional` **overtime\_hours**: `number` \| `null`

##### Tables.weekly\_schedules.Insert.overtime\_notes?

> `optional` **overtime\_notes**: `string` \| `null`

##### Tables.weekly\_schedules.Insert.schedule\_config?

> `optional` **schedule\_config**: [`Json`](Json.md)

##### Tables.weekly\_schedules.Insert.updated\_at?

> `optional` **updated\_at**: `string` \| `null`

##### Tables.weekly\_schedules.Insert.user\_id

> **user\_id**: `string`

##### Tables.weekly\_schedules.Insert.week\_start\_date

> **week\_start\_date**: `string`

##### Tables.weekly\_schedules.Relationships

> **Relationships**: \[\]

##### Tables.weekly\_schedules.Row

> **Row**: `object`

##### Tables.weekly\_schedules.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.weekly\_schedules.Row.id

> **id**: `number`

##### Tables.weekly\_schedules.Row.overtime\_hours

> **overtime\_hours**: `number` \| `null`

##### Tables.weekly\_schedules.Row.overtime\_notes

> **overtime\_notes**: `string` \| `null`

##### Tables.weekly\_schedules.Row.schedule\_config

> **schedule\_config**: [`Json`](Json.md)

##### Tables.weekly\_schedules.Row.updated\_at

> **updated\_at**: `string` \| `null`

##### Tables.weekly\_schedules.Row.user\_id

> **user\_id**: `string`

##### Tables.weekly\_schedules.Row.week\_start\_date

> **week\_start\_date**: `string`

##### Tables.weekly\_schedules.Update

> **Update**: `object`

##### Tables.weekly\_schedules.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.weekly\_schedules.Update.id?

> `optional` **id**: `number`

##### Tables.weekly\_schedules.Update.overtime\_hours?

> `optional` **overtime\_hours**: `number` \| `null`

##### Tables.weekly\_schedules.Update.overtime\_notes?

> `optional` **overtime\_notes**: `string` \| `null`

##### Tables.weekly\_schedules.Update.schedule\_config?

> `optional` **schedule\_config**: [`Json`](Json.md)

##### Tables.weekly\_schedules.Update.updated\_at?

> `optional` **updated\_at**: `string` \| `null`

##### Tables.weekly\_schedules.Update.user\_id?

> `optional` **user\_id**: `string`

##### Tables.weekly\_schedules.Update.week\_start\_date?

> `optional` **week\_start\_date**: `string`

##### Tables.work\_sessions

> **work\_sessions**: `object`

##### Tables.work\_sessions.Insert

> **Insert**: `object`

##### Tables.work\_sessions.Insert.auto\_closed?

> `optional` **auto\_closed**: `boolean` \| `null`

##### Tables.work\_sessions.Insert.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.work\_sessions.Insert.device\_fingerprint?

> `optional` **device\_fingerprint**: `string` \| `null`

##### Tables.work\_sessions.Insert.id?

> `optional` **id**: `number`

##### Tables.work\_sessions.Insert.ip\_address?

> `optional` **ip\_address**: `string` \| `null`

##### Tables.work\_sessions.Insert.is\_overtime?

> `optional` **is\_overtime**: `boolean` \| `null`

##### Tables.work\_sessions.Insert.session\_end?

> `optional` **session\_end**: `string` \| `null`

##### Tables.work\_sessions.Insert.session\_start?

> `optional` **session\_start**: `string` \| `null`

##### Tables.work\_sessions.Insert.user\_agent?

> `optional` **user\_agent**: `string` \| `null`

##### Tables.work\_sessions.Insert.user\_id

> **user\_id**: `string`

##### Tables.work\_sessions.Relationships

> **Relationships**: \[\]

##### Tables.work\_sessions.Row

> **Row**: `object`

##### Tables.work\_sessions.Row.auto\_closed

> **auto\_closed**: `boolean` \| `null`

##### Tables.work\_sessions.Row.created\_at

> **created\_at**: `string` \| `null`

##### Tables.work\_sessions.Row.device\_fingerprint

> **device\_fingerprint**: `string` \| `null`

##### Tables.work\_sessions.Row.id

> **id**: `number`

##### Tables.work\_sessions.Row.ip\_address

> **ip\_address**: `string` \| `null`

##### Tables.work\_sessions.Row.is\_overtime

> **is\_overtime**: `boolean` \| `null`

##### Tables.work\_sessions.Row.session\_end

> **session\_end**: `string` \| `null`

##### Tables.work\_sessions.Row.session\_start

> **session\_start**: `string` \| `null`

##### Tables.work\_sessions.Row.user\_agent

> **user\_agent**: `string` \| `null`

##### Tables.work\_sessions.Row.user\_id

> **user\_id**: `string`

##### Tables.work\_sessions.Update

> **Update**: `object`

##### Tables.work\_sessions.Update.auto\_closed?

> `optional` **auto\_closed**: `boolean` \| `null`

##### Tables.work\_sessions.Update.created\_at?

> `optional` **created\_at**: `string` \| `null`

##### Tables.work\_sessions.Update.device\_fingerprint?

> `optional` **device\_fingerprint**: `string` \| `null`

##### Tables.work\_sessions.Update.id?

> `optional` **id**: `number`

##### Tables.work\_sessions.Update.ip\_address?

> `optional` **ip\_address**: `string` \| `null`

##### Tables.work\_sessions.Update.is\_overtime?

> `optional` **is\_overtime**: `boolean` \| `null`

##### Tables.work\_sessions.Update.session\_end?

> `optional` **session\_end**: `string` \| `null`

##### Tables.work\_sessions.Update.session\_start?

> `optional` **session\_start**: `string` \| `null`

##### Tables.work\_sessions.Update.user\_agent?

> `optional` **user\_agent**: `string` \| `null`

##### Tables.work\_sessions.Update.user\_id?

> `optional` **user\_id**: `string`

#### Views

> **Views**: `{ [_ in never]: never }`
