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
