[**Mesa de Soporte Técnico - API Documentation**](../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../modules.md) / [app/admin/types](../README.md) / Enums

# Type Alias: Enums\<DefaultSchemaEnumNameOrOptions, EnumName\>

> **Enums**\<`DefaultSchemaEnumNameOrOptions`, `EnumName`\> = `DefaultSchemaEnumNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`DefaultSchemaEnumNameOrOptions`\[`"schema"`\]\]\[`"Enums"`\]\[`EnumName`\] : `DefaultSchemaEnumNameOrOptions` *extends* keyof `DefaultSchema`\[`"Enums"`\] ? `DefaultSchema`\[`"Enums"`\]\[`DefaultSchemaEnumNameOrOptions`\] : `never`

Defined in: [app/admin/types.ts:811](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L811)

## Type Parameters

### DefaultSchemaEnumNameOrOptions

`DefaultSchemaEnumNameOrOptions` *extends* keyof `DefaultSchema`\[`"Enums"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

### EnumName

`EnumName` *extends* `DefaultSchemaEnumNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`DefaultSchemaEnumNameOrOptions`\[`"schema"`\]\]\[`"Enums"`\] : `never` = `never`
