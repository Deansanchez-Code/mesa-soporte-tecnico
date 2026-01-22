[**Mesa de Soporte Técnico - API Documentation**](../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../modules.md) / [app/admin/types](../README.md) / Tables

# Type Alias: Tables\<DefaultSchemaTableNameOrOptions, TableName\>

> **Tables**\<`DefaultSchemaTableNameOrOptions`, `TableName`\> = `DefaultSchemaTableNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\] & `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Views"`\]\[`TableName`\] *extends* `object` ? `R` : `never` : `DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] & `DefaultSchema`\[`"Views"`\] ? `DefaultSchema`\[`"Tables"`\] & `DefaultSchema`\[`"Views"`\]\[`DefaultSchemaTableNameOrOptions`\] *extends* `object` ? `R` : `never` : `never`

Defined in: [app/admin/types.ts:732](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L732)

## Type Parameters

### DefaultSchemaTableNameOrOptions

`DefaultSchemaTableNameOrOptions` *extends* keyof `DefaultSchema`\[`"Tables"`\] & `DefaultSchema`\[`"Views"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

### TableName

`TableName` *extends* `DefaultSchemaTableNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Tables"`\] & `DatabaseWithoutInternals`\[`DefaultSchemaTableNameOrOptions`\[`"schema"`\]\]\[`"Views"`\] : `never` = `never`
