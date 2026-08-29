import { supabase } from "@/lib/supabase/client";
import { SpaceMaintenanceConfig } from "../types";

export const DEFAULT_AUDITORIUM_MAINTENANCE: SpaceMaintenanceConfig = {
  is_active: false,
  space_id: "1",
  start_date: "2026-09-01",
  end_date: null,
  custom_title: "Auditorio en Remodelación",
  custom_message: "",
};

export async function getAuditoriumMaintenanceConfig(): Promise<SpaceMaintenanceConfig> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "auditorium_maintenance")
      .maybeSingle();

    if (error || !data || !data.value) {
      return DEFAULT_AUDITORIUM_MAINTENANCE;
    }

    return {
      ...DEFAULT_AUDITORIUM_MAINTENANCE,
      ...(data.value as unknown as SpaceMaintenanceConfig),
    };
  } catch (err) {
    console.error("Error fetching auditorium maintenance config:", err);
    return DEFAULT_AUDITORIUM_MAINTENANCE;
  }
}
