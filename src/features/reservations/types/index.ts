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
  space_id: string; // '1': Auditorio
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD (optional)
  custom_title?: string;
  custom_message?: string;
}
