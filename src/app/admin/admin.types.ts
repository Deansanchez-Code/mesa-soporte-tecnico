import { Tables, Json } from "./types";

export interface Ticket extends Tables<"tickets"> {
  users: { full_name: string; area: string | null } | null;
  assigned_agent: { full_name: string } | null;
  assets: {
    model: string | null;
    type: string | null;
    serial_number: string;
  } | null;
}

export interface ConfigItem {
  id: number;
  name: string;
}

export interface Agent {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  role: string;
  area: string | null;
  created_at: string | null;
  is_active: boolean;
  perm_create_assets: boolean | null;
  perm_transfer_assets: boolean | null;
  perm_decommission_assets: boolean | null;
  perm_manage_assignments?: boolean;
  is_vip: boolean;
  employment_type?: string | null;
  job_category?: string | null;
  auth_id?: string | null;
}

export type User = Agent;

export interface Asset {
  id: number;
  serial_number: string;
  type: string | null;
  brand: string | null;
  model: string | null;
  location: string | null;
  assigned_to_user_id: string | null;
  created_at: string | null;
  users: {
    full_name: string;
  } | null;
}

export interface Stats {
  totalTickets: number;
  pendingTickets: number;
  totalAssets: number;
}

export interface StaffUploadRow {
  "Nombre Completo": string;
  Usuario: string;
  Ubicación: string;
  VIP?: string;
}

export type AdminTab =
  | "assets"
  | "tickets"
  | "agents"
  | "contractors"
  | "metrics"
  | "qr"
  | "settings"
  | "staff"
  | "audit"
  | "shifts";

export type TicketFilterType = "ALL" | "PENDING";

export interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  resource: string | null;
  resource_id: string | null;
  details: Json | null;
  users: {
    full_name: string;
    email: string | null;
  } | null;
}
