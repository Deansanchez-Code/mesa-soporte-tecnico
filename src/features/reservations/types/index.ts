export interface Reservation {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: "APPROVED" | "CANCELLED" | "PENDING" | "CONFIRMED";
  user_id: string;
  auditorium_id?: string;
  resources?: string[];
  description?: string | null;
  users?: {
    full_name: string;
    is_vip: boolean;
    role?: string;
  };
}

export interface SpaceMaintenanceConfig {
  is_active: boolean;
  space_id: string; // '1': Auditorio 103, '2': Subdirección, '3': Biblioteca, '4': Ambiente 107, '5': Cocina, o 'area:<id>'
  space_name?: string;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD (optional)
  custom_title?: string;
  custom_message?: string;
  reactivated_at?: string | null;
  reactivated_message?: string | null;
  updated_at?: string;
  updated_by?: string;
}

export interface SpaceCoordinatorAssignment {
  user_id: string; // UUID de public.users
  username: string;
  email: string;
  full_name: string;
  is_vip?: boolean;
  assigned_at?: string;
  assigned_by?: string;
}

export interface EnvironmentsGlobalConfig {
  tab_order: number[]; // Ordered array of area IDs
  disabled_area_ids: number[]; // Area IDs disabled by superadmin (in Gestión de Ambientes)
  disabled_special_spaces: string[]; // '1' | '2' | '3' | '4' | '5' disabled by superadmin
  coordinators?: Record<string, SpaceCoordinatorAssignment>; // "3" (Biblioteca) | "4" (107) | "5" (Cocina)
  updated_at?: string;
  updated_by?: string;
}
