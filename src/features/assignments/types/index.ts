import { TimeBlock } from "@/lib/scheduling";

export interface Assignment {
  id: number;
  instructor_id: string;
  assignment_date: string; // YYYY-MM-DD
  time_block: TimeBlock;
  instructor: {
    full_name: string;
  };
  is_reservation?: boolean;
  user_id?: string;
  title?: string;
  start_time?: string | null;
  end_time?: string | null;
  resources?: string[] | null;
  status?: "APPROVED" | "CANCELLED";
  users?: {
    full_name: string;
    is_vip: boolean;
  };
}
