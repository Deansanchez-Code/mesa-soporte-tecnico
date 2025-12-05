export interface Agent {
  id: string;
  auth_id?: string;
  full_name: string;
  username: string;
  email?: string;
  role: string;
  area?: string;
  created_at: string;
  is_active: boolean;
  employment_type?: "planta" | "contratista";
  job_category?: "instructor" | "funcionario";
  perm_create_assets: boolean;
  perm_transfer_assets: boolean;
  perm_decommission_assets: boolean;
  is_vip: boolean;
}

export interface User {
  id: string;
  auth_id?: string;
  full_name: string;
  username: string;
  email?: string;
  role: string;
  area?: string;
  is_vip: boolean;
  is_active: boolean;
  employment_type?: "planta" | "contratista";
  job_category?: "instructor" | "funcionario";
  // Optional permissions for when treating a generic User as one with potential agent capabilities
  perm_create_assets?: boolean;
  perm_transfer_assets?: boolean;
  perm_decommission_assets?: boolean;
}

export interface ConfigItem {
  id: number;
  name: string;
  created_at?: string;
}

export interface Asset {
  id: number;
  serial_number: string;
  type: string;
  brand: string;
  model: string;
  assigned_to_user_id: string;
  location?: string;
  users?: { full_name: string };
  created_at?: string;
}

export interface Ticket {
  id: number;
  created_at: string;
  status: string;
  category: string;
  location: string;
  description: string;
  users: { full_name: string } | null;
  assigned_agent?: { full_name: string } | null;
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
