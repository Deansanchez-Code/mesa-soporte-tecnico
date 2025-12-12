import { Ticket } from "@/app/admin/types";

export interface TicketEvent {
  id: number;
  created_at: string;
  action_type: string;
  old_value?: string;
  new_value?: string;
  comment?: string;
  actor_id?: string;
  actor_name?: string;
}

export interface PauseReason {
  id: number;
  reason_code: string;
  description: string;
}

export interface TimelineItem {
  type: "legacy" | "event" | "creation";
  date: number;
  displayDate: string;
  title: string;
  text?: string;
  actor?: string;
  rawType?: string;
}

export type { Ticket };
