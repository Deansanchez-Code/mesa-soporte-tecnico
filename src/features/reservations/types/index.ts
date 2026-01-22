export interface Reservation {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: "APPROVED" | "CANCELLED";
  user_id: string;
  auditorium_id?: string;
  resources?: string[];
  users?: {
    full_name: string;
    is_vip: boolean;
  };
}
