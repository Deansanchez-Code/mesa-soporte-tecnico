[**Mesa de Soporte Técnico - API Documentation**](../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../modules.md) / [app/admin/types](../README.md) / TablesUpdate

# Type Alias: TablesUpdate\<DefaultSchemaTableNameOrOptions, TableName\>

> **TablesUpdate**\<`DefaultSchemaTableNameOrOptions`, `TableName`\> = `DefaultSchemaTableNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\]\[`TableName`\] *extends* `object` ? `U` : `never` : `DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] ? `DefaultSchema`\[`"Tables"`\]\[`DefaultSchemaTableNameOrOptions`\] *extends* `object` ? `U` : `never` : `never`

Defined in: [app/admin/types.ts:786](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L786)

## Type Parameters

### DefaultSchemaTableNameOrOptions

`DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

### TableName

`TableName` *extends* `DefaultSchemaTableNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\] : `never` = `never`
