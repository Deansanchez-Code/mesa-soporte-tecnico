export interface User {
  id: string;
  full_name: string;
  area: string;
  username: string;
  role: string;
  perm_manage_assignments?: boolean;
  employment_type?: string;
  job_category?: string;
  is_vip?: boolean;
}

export interface Asset {
  id: number;
  serial_number: string;
  type: string;
  brand: string;
  model: string;
  location?: string;
  assigned_to_user_id?: string;
}

export interface Outage {
  id: number;
  title: string;
  description: string;
  location_scope?: string;
  is_active?: boolean;
}
