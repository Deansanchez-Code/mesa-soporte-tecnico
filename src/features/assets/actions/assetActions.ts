"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AssetService } from "../services/asset.service";
import Logger from "@/lib/logger";
import {
  buildUserIdOrFilter,
  isSafeStoragePathOrUrl,
  UUID_SCHEMA,
} from "@/lib/security";
import { z } from "zod";

const AssetActionSchema = z.object({
  assetId: z.number().int().positive(),
  actionType: z.enum(["TRANSFER", "DECOMMISSION"]),
  targetUserId: UUID_SCHEMA.optional(),
  comments: z.string().trim().max(1000).optional(),
  fileUrl: z
    .string()
    .trim()
    .min(1, "El archivo de soporte es obligatorio")
    .refine(isSafeStoragePathOrUrl, "Ruta de archivo de autorización inválida"),
});

export type AssetActionInput = z.infer<typeof AssetActionSchema>;

export async function processAssetAction(input: AssetActionInput) {
  try {
    const supabase = await createClient();

    // 1. Auth Check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("No autenticado");
    }

    // 2. Validate Input
    const validatedData = AssetActionSchema.parse(input);

    // 3. RBAC Authorization Check (ISO 27001 A.8.2 / A.5.15)
    const { data: actorProfile } = await supabase
      .from("users")
      .select(
        "id, role, is_active, perm_transfer_assets, perm_decommission_assets",
      )
      .or(buildUserIdOrFilter(user.id))
      .maybeSingle();

    if (!actorProfile || actorProfile.is_active === false) {
      throw new Error("Usuario inactivo o no autorizado");
    }

    const actorRole = String(actorProfile.role || "").toLowerCase();
    const isAdmin = ["admin", "superadmin"].includes(actorRole);
    const hasSpecificPerm =
      validatedData.actionType === "TRANSFER"
        ? Boolean(actorProfile.perm_transfer_assets)
        : Boolean(actorProfile.perm_decommission_assets);

    if (!isAdmin && !hasSpecificPerm) {
      throw new Error(
        "Acceso denegado: no tienes permisos autorizados para esta operación de inventario.",
      );
    }

    // 4. Get Current Asset Data (to know previous owner)
    const { data: asset, error: fetchError } = await supabase
      .from("assets")
      .select("assigned_to_user_id")
      .eq("id", validatedData.assetId)
      .single();

    if (fetchError || !asset) {
      throw new Error("Activo no encontrado");
    }

    // 5. Determine New Owner
    let newOwnerId = validatedData.targetUserId;

    if (validatedData.actionType === "TRANSFER") {
      if (!newOwnerId)
        throw new Error(
          "Debe seleccionar un nuevo responsable para traslados.",
        );
    } else if (validatedData.actionType === "DECOMMISSION") {
      // ID fijo para 'Equipos de Baja'
      newOwnerId = "00000000-0000-0000-0000-000000000000";
    }

    if (!newOwnerId) throw new Error("ID de nuevo propietario no válido.");

    // 6. Log the Action
    await AssetService.logAssetAction(
      validatedData.assetId,
      validatedData.actionType,
      asset.assigned_to_user_id,
      newOwnerId,
      actorProfile.id || user.id,
      validatedData.fileUrl,
      validatedData.comments,
    );

    // 7. Update Asset Assignment
    await AssetService.updateAssetAssignment(validatedData.assetId, newOwnerId);

    // 8. Revalidate
    revalidatePath("/dashboard/assets");
    revalidatePath("/dashboard/inventory");

    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";

    await Logger.error(`Asset Action Failed: ${errorMessage}`, {
      assetId: input?.assetId,
      actionType: input?.actionType,
    });

    return { success: false, error: errorMessage };
  }
}
