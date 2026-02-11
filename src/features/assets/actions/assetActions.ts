"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/servidor";
import { AssetService } from "../services/asset.service";
import Logger from "@/lib/logger";
import { z } from "zod";

const AssetActionSchema = z.object({
  assetId: z.number(),
  actionType: z.enum(["TRANSFER", "DECOMMISSION"]),
  targetUserId: z.string().optional(), // Required for TRANSFER
  comments: z.string().optional(),
  fileUrl: z.string().min(1, "El archivo de soporte es obligatorio"),
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

    // 3. Get Current Asset Data (to know previous owner)
    const { data: asset, error: fetchError } = await supabase
      .from("assets")
      .select("assigned_to_user_id")
      .eq("id", validatedData.assetId)
      .single();

    if (fetchError || !asset) {
      throw new Error("Activo no encontrado");
    }

    // 4. Determine New Owner
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

    // 5. Log the Action
    await AssetService.logAssetAction(
      validatedData.assetId,
      validatedData.actionType,
      asset.assigned_to_user_id,
      newOwnerId,
      user.id,
      validatedData.fileUrl,
      validatedData.comments,
    );

    // 6. Update Asset Assignment
    await AssetService.updateAssetAssignment(validatedData.assetId, newOwnerId);

    // 7. Revalidate
    revalidatePath("/dashboard/assets");
    revalidatePath("/dashboard/inventory");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error in processAssetAction:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";

    // Log intent to structured logger
    await Logger.error(`Asset Action Failed: ${errorMessage}`, {
      input,
      error,
    });

    return { success: false, error: errorMessage };
  }
}
