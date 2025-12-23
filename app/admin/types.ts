export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      asset_events: {
        Row: {
          actor_id: string | null
          asset_serial: string
          created_at: string | null
          description: string | null
          event_type: string
          id: number
        }
        Insert: {
          actor_id?: string | null
          asset_serial: string
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: number
        }
        Update: {
          actor_id?: string | null
          asset_serial?: string
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_logs: {
        Row: {
          action_type: string
          asset_id: number
          authorization_file_url: string
          comments: string | null
          created_at: string
          id: string
          new_user_id: string | null
          performed_by_user_id: string
          previous_user_id: string | null
        }
        Insert: {
          action_type: string
          asset_id: number
          authorization_file_url: string
          comments?: string | null
          created_at?: string
          id?: string
          new_user_id?: string | null
          performed_by_user_id: string
          previous_user_id?: string | null
        }
        Update: {
          action_type?: string
          asset_id?: number
          authorization_file_url?: string
          comments?: string | null
          created_at?: string
          id?: string
          new_user_id?: string | null
          performed_by_user_id?: string
          previous_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_logs_new_user_id_fkey"
            columns: ["new_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_logs_performed_by_user_id_fkey"
            columns: ["performed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_logs_previous_user_id_fkey"
            columns: ["previous_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          assigned_to_user_id: string | null
          brand: string | null
          created_at: string | null
          id: number
          location: string | null
          model: string | null
          serial_number: string
          type: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          brand?: string | null
          created_at?: string | null
          id?: number
          location?: string | null
          model?: string | null
          serial_number: string
          type?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          brand?: string | null
          created_at?: string | null
          id?: number
          location?: string | null
          model?: string | null
          serial_number?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource: string | null
          resource_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource?: string | null
          resource_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource?: string | null
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      mass_outages: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: number
          is_active: boolean | null
          location_scope: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          location_scope: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          location_scope?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_outages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outage_reports: {
        Row: {
          created_at: string | null
          id: number
          location: string
          reported_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          location: string
          reported_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          location?: string
          reported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outage_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pause_reasons: {
        Row: {
          created_at: string | null
          id: number
          is_active: boolean | null
          reason_text: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          reason_text: string
        }
        Update: {
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          reason_text?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          auditorium_id: string | null
          created_at: string | null
          end_time: string
          id: number
          resources: string[] | null
          start_time: string
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          auditorium_id?: string | null
          created_at?: string | null
          end_time: string
          id?: number
          resources?: string[] | null
          start_time: string
          status?: string
          title: string
          user_id?: string | null
        }
        Update: {
          auditorium_id?: string | null
          created_at?: string | null
          end_time?: string
          id?: number
          resources?: string[] | null
          start_time?: string
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      ticket_categories_config: {
        Row: {
          id: number
          internal_type: Database["public"]["Enums"]["ticket_type_enum"]
          is_active: boolean | null
          priority_level: string | null
          sla_hours_std: number | null
          sla_hours_vip: number | null
          user_selection_text: string
        }
        Insert: {
          id?: number
          internal_type: Database["public"]["Enums"]["ticket_type_enum"]
          is_active?: boolean | null
          priority_level?: string | null
          sla_hours_std?: number | null
          sla_hours_vip?: number | null
          user_selection_text: string
        }
        Update: {
          id?: number
          internal_type?: Database["public"]["Enums"]["ticket_type_enum"]
          is_active?: boolean | null
          priority_level?: string | null
          sla_hours_std?: number | null
          sla_hours_vip?: number | null
          user_selection_text?: string
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          action_type: Database["public"]["Enums"]["audit_action_type_enum"]
          actor_id: string | null
          comment: string | null
          created_at: string | null
          id: number
          new_value: string | null
          old_value: string | null
          ticket_id: number | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["audit_action_type_enum"]
          actor_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: number
          new_value?: string | null
          old_value?: string | null
          ticket_id?: number | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["audit_action_type_enum"]
          actor_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: number
          new_value?: string | null
          old_value?: string | null
          ticket_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_serial: string | null
          assigned_agent_id: string | null
          category: string | null
          created_at: string | null
          description: string | null
          hold_reason: string | null
          id: number
          is_vip_ticket: boolean | null
          location: string
          sla_clock_stopped_at: string | null
          sla_expected_end_at: string | null
          sla_last_paused_at: string | null
          sla_pause_reason: string | null
          sla_start_at: string | null
          sla_status: Database["public"]["Enums"]["sla_status_enum"] | null
          sla_total_paused_duration: unknown
          solution: string | null
          status: string | null
          ticket_code: string | null
          ticket_type: Database["public"]["Enums"]["ticket_type_enum"] | null
          total_hold_time: unknown
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_serial?: string | null
          assigned_agent_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          hold_reason?: string | null
          id?: number
          is_vip_ticket?: boolean | null
          location: string
          sla_clock_stopped_at?: string | null
          sla_expected_end_at?: string | null
          sla_last_paused_at?: string | null
          sla_pause_reason?: string | null
          sla_start_at?: string | null
          sla_status?: Database["public"]["Enums"]["sla_status_enum"] | null
          sla_total_paused_duration?: unknown
          solution?: string | null
          status?: string | null
          ticket_code?: string | null
          ticket_type?: Database["public"]["Enums"]["ticket_type_enum"] | null
          total_hold_time?: unknown
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_serial?: string | null
          assigned_agent_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          hold_reason?: string | null
          id?: number
          is_vip_ticket?: boolean | null
          location?: string
          sla_clock_stopped_at?: string | null
          sla_expected_end_at?: string | null
          sla_last_paused_at?: string | null
          sla_pause_reason?: string | null
          sla_start_at?: string | null
          sla_status?: Database["public"]["Enums"]["sla_status_enum"] | null
          sla_total_paused_duration?: unknown
          solution?: string | null
          status?: string | null
          ticket_code?: string | null
          ticket_type?: Database["public"]["Enums"]["ticket_type_enum"] | null
          total_hold_time?: unknown
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_serial_fkey"
            columns: ["asset_serial"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["serial_number"]
          },
          {
            foreignKeyName: "tickets_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          area: string | null
          auth_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          employment_type: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_vip: boolean | null
          job_category: string | null
          password: string | null
          perm_create_assets: boolean | null
          perm_decommission_assets: boolean | null
          perm_transfer_assets: boolean | null
          role: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          area?: string | null
          auth_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          employment_type?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          is_vip?: boolean | null
          job_category?: string | null
          password?: string | null
          perm_create_assets?: boolean | null
          perm_decommission_assets?: boolean | null
          perm_transfer_assets?: boolean | null
          role?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          area?: string | null
          auth_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          employment_type?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_vip?: boolean | null
          job_category?: string | null
          password?: string | null
          perm_create_assets?: boolean | null
          perm_decommission_assets?: boolean | null
          perm_transfer_assets?: boolean | null
          role?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      weekly_schedules: {
        Row: {
          created_at: string | null
          id: number
          overtime_hours: number | null
          overtime_notes: string | null
          schedule_config: Json
          updated_at: string | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          overtime_hours?: number | null
          overtime_notes?: string | null
          schedule_config?: Json
          updated_at?: string | null
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          id?: number
          overtime_hours?: number | null
          overtime_notes?: string | null
          schedule_config?: Json
          updated_at?: string | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          auto_closed: boolean | null
          created_at: string | null
          device_fingerprint: string | null
          id: number
          ip_address: string | null
          is_overtime: boolean | null
          session_end: string | null
          session_start: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auto_closed?: boolean | null
          created_at?: string | null
          device_fingerprint?: string | null
          id?: number
          ip_address?: string | null
          is_overtime?: boolean | null
          session_end?: string | null
          session_start?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auto_closed?: boolean | null
          created_at?: string | null
          device_fingerprint?: string | null
          id?: number
          ip_address?: string | null
          is_overtime?: boolean | null
          session_end?: string | null
          session_start?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_deadline: {
        Args: { p_hours: number; p_start_time: string }
        Returns: string
      }
    }
    Enums: {
      audit_action_type_enum:
        | "CREATED"
        | "STATUS_CHANGE"
        | "PAUSED"
        | "RESUMED"
        | "COMMENT_ADDED"
        | "RECLASSIFIED"
      sla_status_enum: "running" | "paused" | "breached" | "completed"
      ticket_type_enum: "INC" | "REQ"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_action_type_enum: [
        "CREATED",
        "STATUS_CHANGE",
        "PAUSED",
        "RESUMED",
        "COMMENT_ADDED",
        "RECLASSIFIED",
      ],
      sla_status_enum: ["running", "paused", "breached", "completed"],
      ticket_type_enum: ["INC", "REQ"],
    },
  },
} as const
