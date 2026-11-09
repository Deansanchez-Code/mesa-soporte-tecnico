import { supabase } from "@/lib/supabase/client";
import { SpaceMaintenanceConfig, EnvironmentsGlobalConfig } from "../types";

export const DEFAULT_AUDITORIUM_MAINTENANCE: SpaceMaintenanceConfig = {
  is_active: false,
  space_id: "1",
  start_date: "2026-09-01",
  end_date: null,
  custom_title: "Auditorio en Remodelación",
  custom_message: "",
};

export const DEFAULT_ENVIRONMENTS_CONFIG: EnvironmentsGlobalConfig = {
  tab_order: [],
  disabled_area_ids: [],
  disabled_special_spaces: [],
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

export async function getEnvironmentsGlobalConfig(): Promise<EnvironmentsGlobalConfig> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "environments_global_config")
      .maybeSingle();

    if (error || !data || !data.value) {
      return DEFAULT_ENVIRONMENTS_CONFIG;
    }

    const val = data.value as Partial<EnvironmentsGlobalConfig>;
    return {
      tab_order: Array.isArray(val.tab_order) ? val.tab_order : [],
      disabled_area_ids: Array.isArray(val.disabled_area_ids)
        ? val.disabled_area_ids
        : [],
      disabled_special_spaces: Array.isArray(val.disabled_special_spaces)
        ? val.disabled_special_spaces
        : [],
      updated_at: val.updated_at,
      updated_by: val.updated_by,
    };
  } catch (err) {
    console.error("Error fetching environments global config:", err);
    return DEFAULT_ENVIRONMENTS_CONFIG;
  }
}
