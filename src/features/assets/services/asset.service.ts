import { createClient } from "@/lib/supabase/servidor";

export type AssetActionType = "TRANSFER" | "DECOMMISSION";

export class AssetService {
  /**
   * Registra un log de movimiento para un activo.
   */
  static async logAssetAction(
    assetId: number,
    actionType: AssetActionType,
    previousUserId: string,
    newUserId: string,
    performedByUserId: string,
    authorizationFileUrl: string,
    comments?: string,
  ) {
    const supabase = await createClient();

    const { error } = await supabase.from("asset_logs").insert({
      asset_id: assetId,
      action_type: actionType,
      previous_user_id: previousUserId,
      new_user_id: newUserId,
      performed_by_user_id: performedByUserId,
      authorization_file_url: authorizationFileUrl,
      comments: comments,
    });

    if (error) throw new Error(`Error logging asset action: ${error.message}`);
  }

  /**
   * Actualiza el usuario asignado a un activo (Traslado o Baja).
   */
  static async updateAssetAssignment(assetId: number, newUserId: string) {
    const supabase = await createClient();

    const { error } = await supabase
      .from("assets")
      .update({ assigned_to_user_id: newUserId })
      .eq("id", assetId);

    if (error)
      throw new Error(`Error updating asset assignment: ${error.message}`);
  }
}
