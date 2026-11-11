import { supabase } from "@/lib/supabase/client";
import { SpaceMaintenanceConfig, EnvironmentsGlobalConfig } from "../types";

export const SPECIAL_SPACES_CATALOG: Array<{ id: string; name: string }> = [
  { id: "1", name: "Auditorio 103" },
  { id: "2", name: "Subdirección" },
  { id: "3", name: "Biblioteca" },
  { id: "4", name: "Ambiente 107" },
  { id: "5", name: "Ambiente de Cocina" },
];

export function resolveSpaceDisplayName(
  spaceId: string,
  areas?: Array<{ id: number; name: string }>,
): string {
  const foundSpecial = SPECIAL_SPACES_CATALOG.find((s) => s.id === spaceId);
  if (foundSpecial) return foundSpecial.name;
  if (spaceId.startsWith("area:") && areas) {
    const areaIdNum = Number(spaceId.replace("area:", ""));
    const foundArea = areas.find((a) => a.id === areaIdNum);
    if (foundArea) return foundArea.name;
  }
  return "Espacio Institucional";
}

export const DEFAULT_AUDITORIUM_MAINTENANCE: SpaceMaintenanceConfig = {
  is_active: false,
  space_id: "1",
  space_name: "Auditorio 103",
  start_date: "2026-09-01",
  end_date: null,
  custom_title: "Auditorio 103 en Remodelación",
  custom_message: "",
};

export const DEFAULT_ENVIRONMENTS_CONFIG: EnvironmentsGlobalConfig = {
  tab_order: [],
  disabled_area_ids: [],
  disabled_special_spaces: [],
};

export async function getAllSpacesMaintenanceConfig(): Promise<
  Record<string, SpaceMaintenanceConfig>
> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["spaces_maintenance", "auditorium_maintenance"]);

    if (error || !data) {
      return {};
    }

    const result: Record<string, SpaceMaintenanceConfig> = {};
    let legacyAuditorium: SpaceMaintenanceConfig | null = null;

    for (const row of data) {
      if (
        row.key === "spaces_maintenance" &&
        row.value &&
        typeof row.value === "object"
      ) {
        const rawMap = row.value as Record<string, SpaceMaintenanceConfig>;
        for (const [k, v] of Object.entries(rawMap)) {
          if (v && typeof v === "object") {
            result[k] = {
              ...v,
              space_id: v.space_id || k,
              space_name:
                v.space_name || resolveSpaceDisplayName(v.space_id || k),
            };
          }
        }
      }
      if (row.key === "auditorium_maintenance" && row.value) {
        legacyAuditorium = row.value as unknown as SpaceMaintenanceConfig;
      }
    }

    if (
      legacyAuditorium &&
      (!result["1"] ||
        (legacyAuditorium.is_active &&
          !result["1"].is_active &&
          (!result["1"].updated_at ||
            (legacyAuditorium.updated_at &&
              legacyAuditorium.updated_at > result["1"].updated_at))))
    ) {
      result["1"] = {
        ...DEFAULT_AUDITORIUM_MAINTENANCE,
        ...legacyAuditorium,
        space_id: "1",
        space_name: "Auditorio 103",
      };
    }

    return result;
  } catch (err) {
    console.error("Error fetching all spaces maintenance config:", err);
    return {};
  }
}

export async function getAuditoriumMaintenanceConfig(): Promise<SpaceMaintenanceConfig> {
  try {
    const allConfigs = await getAllSpacesMaintenanceConfig();
    if (allConfigs["1"]) {
      return {
        ...DEFAULT_AUDITORIUM_MAINTENANCE,
        ...allConfigs["1"],
      };
    }
    return DEFAULT_AUDITORIUM_MAINTENANCE;
  } catch (err) {
    console.error("Error fetching auditorium maintenance config:", err);
    return DEFAULT_AUDITORIUM_MAINTENANCE;
  }
}

export function isSpaceDateBlocked(
  config: SpaceMaintenanceConfig | undefined,
  dateStr: string,
): boolean {
  if (!config?.is_active || !config.start_date) return false;
  const start = config.start_date;
  const end = config.end_date || "2026-12-31";
  return dateStr >= start && dateStr <= end;
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
