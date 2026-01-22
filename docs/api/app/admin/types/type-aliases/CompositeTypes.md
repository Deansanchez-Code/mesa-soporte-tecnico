[**Mesa de Soporte Técnico - API Documentation**](../../../../README.md)

***

[Mesa de Soporte Técnico - API Documentation](../../../../modules.md) / [app/admin/types](../README.md) / CompositeTypes

# Type Alias: CompositeTypes\<PublicCompositeTypeNameOrOptions, CompositeTypeName\>

> **CompositeTypes**\<`PublicCompositeTypeNameOrOptions`, `CompositeTypeName`\> = `PublicCompositeTypeNameOrOptions` *extends* `object` ? `DatabaseWithoutInternals`\[`PublicCompositeTypeNameOrOptions`\[`"schema"`\]\]\[`"CompositeTypes"`\]\[`CompositeTypeName`\] : `PublicCompositeTypeNameOrOptions` *extends* keyof `DefaultSchema`\[`"CompositeTypes"`\] ? `DefaultSchema`\[`"CompositeTypes"`\]\[`PublicCompositeTypeNameOrOptions`\] : `never`

Defined in: [app/admin/types.ts:828](https://github.com/Deansanchez-Code/mesa-soporte-tecnico/blob/a9388a16dc70289e2847b70f3290b0047880d757/src/app/admin/types.ts#L828)

## Type Parameters

### PublicCompositeTypeNameOrOptions

`PublicCompositeTypeNameOrOptions` *extends* keyof `DefaultSchema`\[`"CompositeTypes"`\] \| \{ `schema`: keyof `DatabaseWithoutInternals`; \}

### CompositeTypeName

`CompositeTypeName` *extends* `PublicCompositeTypeNameOrOptions` *extends* `object` ? keyof `DatabaseWithoutInternals`\[`PublicCompositeTypeNameOrOptions`\[`"schema"`\]\]\[`"CompositeTypes"`\] : `never` = `never`
