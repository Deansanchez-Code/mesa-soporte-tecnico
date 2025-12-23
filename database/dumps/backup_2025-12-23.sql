


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."audit_action_type_enum" AS ENUM (
    'CREATED',
    'STATUS_CHANGE',
    'PAUSED',
    'RESUMED',
    'COMMENT_ADDED',
    'RECLASSIFIED'
);


ALTER TYPE "public"."audit_action_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."sla_status_enum" AS ENUM (
    'running',
    'paused',
    'breached',
    'completed'
);


ALTER TYPE "public"."sla_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."ticket_type_enum" AS ENUM (
    'INC',
    'REQ'
);


ALTER TYPE "public"."ticket_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_deadline"("p_start_time" timestamp with time zone, "p_hours" integer) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- For now, simple addition. 
    -- TODO: Implement business hours logic (Mon-Fri 8-6) if required strictly.
    RETURN p_start_time + (p_hours || ' hours')::INTERVAL;
END;
$$;


ALTER FUNCTION "public"."calculate_deadline"("p_start_time" timestamp with time zone, "p_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_ticket_sla"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    user_is_vip BOOLEAN;
    sla_hours INTEGER;
BEGIN
    -- 1. Verificar si el usuario es VIP
    SELECT is_vip INTO user_is_vip
    FROM users
    WHERE id = NEW.user_id;

    -- Si no se encuentra (usuario eliminado?), asumir false
    IF user_is_vip IS NULL THEN
        user_is_vip := false;
    END IF;

    -- 2. Marcar el ticket como VIP si corresponde
    NEW.is_vip_ticket := user_is_vip;

    -- 3. Definir horas base según prioridad/tipo (Ejemplo simplificado)
    -- Puedes ajustar esto según tu lógica de negocio real
    IF NEW.priority = 'CRITICAL' THEN
        sla_hours := 4;
    ELSIF NEW.priority = 'HIGH' THEN
        sla_hours := 8;
    ELSIF NEW.priority = 'MEDIUM' THEN
        sla_hours := 24;
    ELSE
        sla_hours := 48;
    END IF;

    -- 4. Reducir tiempo a la mitad si es VIP
    IF user_is_vip THEN
        sla_hours := sla_hours / 2;
    END IF;

    -- 5. Calcular fecha límite
    NEW.sla_expected_end_at := NEW.created_at + (sla_hours || ' hours')::INTERVAL;
    NEW.sla_status := 'running';

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_ticket_sla"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_mass_outage_threshold"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  report_count int;
begin
  -- Contamos cuántos reportes hay en esa ubicación en los últimos 10 min
  select count(*) into report_count
  from public.outage_reports
  where location = NEW.location
  and created_at > (now() - interval '10 minutes');

  -- SI EL CONTADOR LLEGA A 3
  if report_count >= 3 then
     -- Verificamos que no exista ya una alerta activa para no duplicar
     if not exists (select 1 from public.mass_outages where location_scope = NEW.location and is_active = true) then
        
        -- ¡CREAR LA ALERTA PÚBLICA!
        insert into public.mass_outages (title, description, is_active, location_scope)
        values (
          'Posible Caída de Red Detectada', 
          'El sistema ha detectado múltiples reportes de falla en ' || NEW.location || ' en los últimos 10 minutos.',
          true,
          NEW.location
        );
     end if;
  end if;
  
  return NEW;
end;
$$;


ALTER FUNCTION "public"."check_mass_outage_threshold"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_ticket_classification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_config RECORD;
    v_seq_val BIGINT;
    v_is_vip BOOLEAN DEFAULT false;
    v_hours INT;
BEGIN
    -- A. Check VIP Status of the CREATOR (User)
    SELECT is_vip INTO v_is_vip FROM public.users WHERE id = NEW.user_id;
    NEW.is_vip_ticket := COALESCE(v_is_vip, false);

    -- B. Find Classification based on Description or Category match
    -- We assume the 'category' column in tickets matches 'user_selection_text'
    SELECT * INTO v_config FROM public.ticket_categories_config 
    WHERE user_selection_text = NEW.category 
    LIMIT 1;

    IF v_config IS NOT NULL THEN
        NEW.ticket_type := v_config.internal_type;
        
        -- C. Calculate SLA
        IF NEW.is_vip_ticket THEN
            v_hours := v_config.sla_hours_vip;
        ELSE
            v_hours := v_config.sla_hours_std;
        END IF;
    ELSE
        -- Fallback if no match found
        NEW.ticket_type := 'REQ'; -- Default Safe
        v_hours := 72;
    END IF;

    -- D. Generate Code using Sequences
    IF NEW.ticket_type = 'INC' THEN
        v_seq_val := nextval('seq_inc');
        NEW.ticket_code := 'INC-' || v_seq_val;
    ELSE
        v_seq_val := nextval('seq_req');
        NEW.ticket_code := 'REQ-' || v_seq_val;
    END IF;

    -- E. Set SLA Timestamps
    NEW.sla_start_at := now();
    NEW.sla_expected_end_at := public.calculate_deadline(now(), v_hours);
    NEW.sla_status := 'running';

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_ticket_classification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_username TEXT;
    v_full_name TEXT;
    v_role TEXT;
    v_area TEXT;
    v_employment_type TEXT;
    v_job_category TEXT;
    v_perm_create BOOLEAN;
    v_perm_transfer BOOLEAN;
    v_perm_decommission BOOLEAN;
    v_is_vip BOOLEAN;
BEGIN
    -- Extraer datos del JSONB raw_user_meta_data
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', v_username);
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
    v_area := NEW.raw_user_meta_data->>'area';
    v_employment_type := NEW.raw_user_meta_data->>'employment_type';
    v_job_category := NEW.raw_user_meta_data->>'job_category';
    
    -- Manejo seguro de booleanos (Postgres JSONB -> Text -> Boolean casting puede fallar si no se limpia)
    v_perm_create := (NEW.raw_user_meta_data->>'perm_create_assets')::BOOLEAN;
    v_perm_transfer := (NEW.raw_user_meta_data->>'perm_transfer_assets')::BOOLEAN;
    v_perm_decommission := (NEW.raw_user_meta_data->>'perm_decommission_assets')::BOOLEAN;
    v_is_vip := (NEW.raw_user_meta_data->>'is_vip')::BOOLEAN;

    INSERT INTO public.users (
        id, auth_id, email, username, full_name, role, is_active,
        area, employment_type, job_category,
        perm_create_assets, perm_transfer_assets, perm_decommission_assets, is_vip
    )
    VALUES (
        NEW.id, NEW.id, NEW.email, v_username, v_full_name, v_role, true,
        v_area, v_employment_type, v_job_category,
        COALESCE(v_perm_create, false), 
        COALESCE(v_perm_transfer, false), 
        COALESCE(v_perm_decommission, false), 
        COALESCE(v_is_vip, false)
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        auth_id = EXCLUDED.id,
        role = EXCLUDED.role,
        area = EXCLUDED.area,
        employment_type = EXCLUDED.employment_type,
        job_category = EXCLUDED.job_category,
        updated_at = now();
        
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_ticket_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Detect Status Change
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO public.ticket_events (ticket_id, actor_id, action_type, old_value, new_value)
            VALUES (NEW.id, auth.uid(), 'STATUS_CHANGE', OLD.status, NEW.status);
        END IF;

        -- Detect Pause
        IF OLD.sla_status = 'running' AND NEW.sla_status = 'paused' THEN
             INSERT INTO public.ticket_events (ticket_id, actor_id, action_type, comment)
            VALUES (NEW.id, auth.uid(), 'PAUSED', NEW.sla_pause_reason);
        END IF;

        -- Detect Resume
        IF OLD.sla_status = 'paused' AND NEW.sla_status = 'running' THEN
             INSERT INTO public.ticket_events (ticket_id, actor_id, action_type)
            VALUES (NEW.id, auth.uid(), 'RESUMED');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_ticket_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."areas" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."areas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."areas_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."areas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."areas_id_seq" OWNED BY "public"."areas"."id";



CREATE TABLE IF NOT EXISTS "public"."asset_events" (
    "id" bigint NOT NULL,
    "asset_serial" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "description" "text",
    "actor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asset_events" OWNER TO "postgres";


ALTER TABLE "public"."asset_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."asset_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."asset_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" bigint NOT NULL,
    "action_type" "text" NOT NULL,
    "previous_user_id" "uuid",
    "new_user_id" "uuid",
    "performed_by_user_id" "uuid" NOT NULL,
    "authorization_file_url" "text" NOT NULL,
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asset_logs_action_type_check" CHECK (("action_type" = ANY (ARRAY['ENTRY'::"text", 'TRANSFER'::"text", 'DECOMMISSION'::"text", 'REACTIVATION'::"text"])))
);


ALTER TABLE "public"."asset_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" bigint NOT NULL,
    "serial_number" "text" NOT NULL,
    "type" "text",
    "brand" "text",
    "model" "text",
    "assigned_to_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "location" "text" DEFAULT 'Sin ubicación'::"text",
    CONSTRAINT "assets_type_check" CHECK (("type" = ANY (ARRAY['Portátil'::"text", 'Escritorio'::"text", 'Monitor'::"text", 'Periférico'::"text"])))
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


ALTER TABLE "public"."assets" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "resource" "text",
    "resource_id" "text",
    "details" "jsonb",
    "ip_address" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."categories_id_seq" OWNED BY "public"."categories"."id";



CREATE TABLE IF NOT EXISTS "public"."mass_outages" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location_scope" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "created_by" "uuid"
);


ALTER TABLE "public"."mass_outages" OWNER TO "postgres";


ALTER TABLE "public"."mass_outages" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."mass_outages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."outage_reports" (
    "id" bigint NOT NULL,
    "location" "text" NOT NULL,
    "reported_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."outage_reports" OWNER TO "postgres";


ALTER TABLE "public"."outage_reports" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."outage_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pause_reasons" (
    "id" integer NOT NULL,
    "reason_text" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pause_reasons" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pause_reasons_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pause_reasons_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pause_reasons_id_seq" OWNED BY "public"."pause_reasons"."id";



CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'APPROVED'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resources" "text"[] DEFAULT '{}'::"text"[],
    "auditorium_id" "text",
    CONSTRAINT "reservations_status_check" CHECK (("status" = ANY (ARRAY['APPROVED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


ALTER TABLE "public"."reservations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."reservations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."seq_inc"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."seq_inc" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."seq_req"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."seq_req" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_categories_config" (
    "id" integer NOT NULL,
    "user_selection_text" "text" NOT NULL,
    "internal_type" "public"."ticket_type_enum" NOT NULL,
    "priority_level" "text" DEFAULT 'medium'::"text",
    "sla_hours_std" integer DEFAULT 24,
    "sla_hours_vip" integer DEFAULT 12,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."ticket_categories_config" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ticket_categories_config_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ticket_categories_config_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ticket_categories_config_id_seq" OWNED BY "public"."ticket_categories_config"."id";



CREATE TABLE IF NOT EXISTS "public"."ticket_events" (
    "id" bigint NOT NULL,
    "ticket_id" bigint,
    "actor_id" "uuid",
    "action_type" "public"."audit_action_type_enum" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_events" OWNER TO "postgres";


ALTER TABLE "public"."ticket_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ticket_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "asset_serial" "text",
    "category" "text",
    "location" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "hold_reason" "text",
    "sla_clock_stopped_at" timestamp with time zone,
    "total_hold_time" interval DEFAULT '00:00:00'::interval,
    "assigned_agent_id" "uuid",
    "solution" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "description" "text",
    "ticket_type" "public"."ticket_type_enum",
    "ticket_code" "text",
    "sla_status" "public"."sla_status_enum" DEFAULT 'running'::"public"."sla_status_enum",
    "sla_start_at" timestamp with time zone DEFAULT "now"(),
    "sla_expected_end_at" timestamp with time zone,
    "sla_total_paused_duration" interval DEFAULT '00:00:00'::interval,
    "sla_last_paused_at" timestamp with time zone,
    "sla_pause_reason" "text",
    "is_vip_ticket" boolean DEFAULT false,
    CONSTRAINT "tickets_status_check" CHECK (("status" = ANY (ARRAY['PENDIENTE'::"text", 'EN_PROGRESO'::"text", 'RESUELTO'::"text", 'CERRADO'::"text", 'EN_ESPERA'::"text"])))
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


ALTER TABLE "public"."tickets" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tickets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'employee'::"text",
    "area" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "password" "text" DEFAULT '123456'::"text",
    "is_vip" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "perm_create_assets" boolean DEFAULT false,
    "perm_transfer_assets" boolean DEFAULT false,
    "perm_decommission_assets" boolean DEFAULT false,
    "email" "text",
    "auth_id" "uuid",
    "deleted_at" timestamp with time zone,
    "employment_type" "text" DEFAULT 'planta'::"text",
    "job_category" "text" DEFAULT 'funcionario'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['superadmin'::"text", 'admin'::"text", 'agent'::"text", 'user'::"text", 'contractor'::"text", 'external'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_schedules" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "schedule_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "overtime_hours" numeric(5,2) DEFAULT 0,
    "overtime_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_schedules" OWNER TO "postgres";


ALTER TABLE "public"."weekly_schedules" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."weekly_schedules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."work_sessions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_start" timestamp with time zone DEFAULT "now"(),
    "session_end" timestamp with time zone,
    "ip_address" "text",
    "user_agent" "text",
    "device_fingerprint" "text",
    "is_overtime" boolean DEFAULT false,
    "auto_closed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."work_sessions" OWNER TO "postgres";


ALTER TABLE "public"."work_sessions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."work_sessions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."areas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."areas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pause_reasons" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pause_reasons_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ticket_categories_config" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ticket_categories_config_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."areas"
    ADD CONSTRAINT "areas_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."areas"
    ADD CONSTRAINT "areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_events"
    ADD CONSTRAINT "asset_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_logs"
    ADD CONSTRAINT "asset_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_serial_number_key" UNIQUE ("serial_number");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_serial_number_unique" UNIQUE ("serial_number");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mass_outages"
    ADD CONSTRAINT "mass_outages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outage_reports"
    ADD CONSTRAINT "outage_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pause_reasons"
    ADD CONSTRAINT "pause_reasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pause_reasons"
    ADD CONSTRAINT "pause_reasons_reason_text_key" UNIQUE ("reason_text");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."ticket_categories_config"
    ADD CONSTRAINT "ticket_categories_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_categories_config"
    ADD CONSTRAINT "ticket_categories_config_user_selection_text_key" UNIQUE ("user_selection_text");



ALTER TABLE ONLY "public"."ticket_events"
    ADD CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."weekly_schedules"
    ADD CONSTRAINT "weekly_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_schedules"
    ADD CONSTRAINT "weekly_schedules_user_id_week_start_date_key" UNIQUE ("user_id", "week_start_date");



ALTER TABLE ONLY "public"."work_sessions"
    ADD CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_asset_events_created_at" ON "public"."asset_events" USING "btree" ("created_at");



CREATE INDEX "idx_asset_events_serial" ON "public"."asset_events" USING "btree" ("asset_serial");



CREATE INDEX "idx_audit_logs_actor" ON "public"."audit_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_ticket_events_ticket_id" ON "public"."ticket_events" USING "btree" ("ticket_id");



CREATE INDEX "idx_tickets_sla_status" ON "public"."tickets" USING "btree" ("sla_status");



CREATE INDEX "idx_tickets_ticket_code" ON "public"."tickets" USING "btree" ("ticket_code");



CREATE INDEX "idx_users_auth_id" ON "public"."users" USING "btree" ("auth_id");



CREATE INDEX "idx_weekly_schedules_user_week" ON "public"."weekly_schedules" USING "btree" ("user_id", "week_start_date");



CREATE INDEX "idx_work_sessions_user_date" ON "public"."work_sessions" USING "btree" ("user_id", "session_start");



CREATE INDEX "users_email_idx" ON "public"."users" USING "btree" ("email");



CREATE INDEX "users_role_idx" ON "public"."users" USING "btree" ("role");



CREATE INDEX "users_username_idx" ON "public"."users" USING "btree" ("username");



CREATE OR REPLACE TRIGGER "handle_tickets_updated" BEFORE UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_users_updated" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_classify_ticket" BEFORE INSERT ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_ticket_classification"();



CREATE OR REPLACE TRIGGER "trg_ticket_audit" AFTER UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_ticket_audit"();



CREATE OR REPLACE TRIGGER "trigger_calculate_ticket_sla" BEFORE INSERT ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_ticket_sla"();



CREATE OR REPLACE TRIGGER "trigger_check_outage" AFTER INSERT ON "public"."outage_reports" FOR EACH ROW EXECUTE FUNCTION "public"."check_mass_outage_threshold"();



ALTER TABLE ONLY "public"."asset_events"
    ADD CONSTRAINT "asset_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."asset_logs"
    ADD CONSTRAINT "asset_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id");



ALTER TABLE ONLY "public"."asset_logs"
    ADD CONSTRAINT "asset_logs_new_user_id_fkey" FOREIGN KEY ("new_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."asset_logs"
    ADD CONSTRAINT "asset_logs_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."asset_logs"
    ADD CONSTRAINT "asset_logs_previous_user_id_fkey" FOREIGN KEY ("previous_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mass_outages"
    ADD CONSTRAINT "mass_outages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."outage_reports"
    ADD CONSTRAINT "outage_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_events"
    ADD CONSTRAINT "ticket_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ticket_events"
    ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_asset_serial_fkey" FOREIGN KEY ("asset_serial") REFERENCES "public"."assets"("serial_number") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."weekly_schedules"
    ADD CONSTRAINT "weekly_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_sessions"
    ADD CONSTRAINT "work_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage all schedules" ON "public"."weekly_schedules" USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"])))));



CREATE POLICY "Admins can view all audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND (("users"."role" = 'admin'::"text") OR ("users"."role" = 'superadmin'::"text"))))));



CREATE POLICY "Admins can view all sessions" ON "public"."work_sessions" FOR SELECT USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"])))));



CREATE POLICY "Admins pueden gestionar areas" ON "public"."areas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins pueden gestionar categorias" ON "public"."categories" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Autenticados pueden leer usuarios" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Autenticados pueden ver areas" ON "public"."areas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Autenticados pueden ver categorias" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Creación de logs para personal autorizado" ON "public"."asset_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['superadmin'::"text", 'admin'::"text", 'agent'::"text"])) AND ("users"."is_active" = true)))));



CREATE POLICY "Crear historial activos (Staff)" ON "public"."asset_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'agent'::"text", 'superadmin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Editar tickets (Staff)" ON "public"."tickets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'agent'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Enable insert for all users" ON "public"."tickets" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users" ON "public"."outage_reports" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users on reservations" ON "public"."reservations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable insert for authenticated users on tickets" ON "public"."tickets" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read access for all on mass_outages" ON "public"."mass_outages" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Enable read access for all users" ON "public"."mass_outages" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users on reservations" ON "public"."reservations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for own user" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Enable read access for users on assigned assets" ON "public"."assets" FOR SELECT TO "authenticated" USING (("assigned_to_user_id" = "auth"."uid"()));



CREATE POLICY "Enable read access for users on own tickets" ON "public"."tickets" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read for all users" ON "public"."tickets" FOR SELECT USING (true);



CREATE POLICY "Enable read for authenticated users" ON "public"."outage_reports" FOR SELECT USING (true);



CREATE POLICY "Enable update for users on own reservations" ON "public"."reservations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Gestionar reserva (Dueño, Admin, Superadmin)" ON "public"."reservations" TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text", 'agent'::"text"])))))));



CREATE POLICY "Lectura de logs para personal autorizado" ON "public"."asset_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['superadmin'::"text", 'admin'::"text", 'agent'::"text"]))))));



CREATE POLICY "Permitir actualizar tickets a todos" ON "public"."tickets" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Permitir insertar reservas" ON "public"."reservations" FOR INSERT WITH CHECK ((("user_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ("users"."id" = "reservations"."user_id")))));



CREATE POLICY "Permitir lectura de areas a todos" ON "public"."areas" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Permitir lectura de categorias a todos" ON "public"."categories" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Permitir todo en areas a todos" ON "public"."areas" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Permitir todo en categorias a todos" ON "public"."categories" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Personal actualiza tickets" ON "public"."tickets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['superadmin'::"text", 'admin'::"text", 'agent'::"text"]))))));



CREATE POLICY "Personal ve todos los tickets" ON "public"."tickets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['superadmin'::"text", 'admin'::"text", 'agent'::"text"]))))));



CREATE POLICY "Solo admins actualizan usuarios" ON "public"."users" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."auth_id" = "auth"."uid"()) AND ("users_1"."role" = 'admin'::"text")))));



CREATE POLICY "Solo admins crean usuarios" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."auth_id" = "auth"."uid"()) AND ("users_1"."role" = 'admin'::"text")))));



CREATE POLICY "Solo admins eliminan usuarios" ON "public"."users" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."auth_id" = "auth"."uid"()) AND ("users_1"."role" = 'admin'::"text")))));



CREATE POLICY "Staff ve todos los activos" ON "public"."assets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'agent'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Todos pueden ver configuracion" ON "public"."system_settings" FOR SELECT USING (true);



CREATE POLICY "Todos pueden ver reservas" ON "public"."reservations" FOR SELECT USING (true);



CREATE POLICY "Users can insert audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "actor_id"));



CREATE POLICY "Users can manage own sessions" ON "public"."work_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own schedules" ON "public"."weekly_schedules" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuarios crean tickets" ON "public"."tickets" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuarios ven su propio perfil" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "auth_id"));



CREATE POLICY "Usuarios ven sus propios tickets" ON "public"."tickets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Ver activos asignados" ON "public"."assets" FOR SELECT TO "authenticated" USING (("assigned_to_user_id" = "auth"."uid"()));



CREATE POLICY "Ver historial activos (Autenticados)" ON "public"."asset_events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Ver tickets (Propio o Staff)" ON "public"."tickets" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'agent'::"text", 'superadmin'::"text"])))))));



ALTER TABLE "public"."areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mass_outages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outage_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "policy_allow_all_actions" ON "public"."assets" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "policy_allow_select_all" ON "public"."assets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reservas_delete_own" ON "public"."reservations" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "reservas_insert_all" ON "public"."reservations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "reservas_select_all" ON "public"."reservations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reservas_update_own" ON "public"."reservations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tickets_insert_any" ON "public"."tickets" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tickets";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."calculate_deadline"("p_start_time" timestamp with time zone, "p_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_deadline"("p_start_time" timestamp with time zone, "p_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_deadline"("p_start_time" timestamp with time zone, "p_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_ticket_sla"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_ticket_sla"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_ticket_sla"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_mass_outage_threshold"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_mass_outage_threshold"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_mass_outage_threshold"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_ticket_classification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_ticket_classification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_ticket_classification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_ticket_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_ticket_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_ticket_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."areas" TO "anon";
GRANT ALL ON TABLE "public"."areas" TO "authenticated";
GRANT ALL ON TABLE "public"."areas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."areas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."areas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."areas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."asset_events" TO "anon";
GRANT ALL ON TABLE "public"."asset_events" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."asset_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."asset_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."asset_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."asset_logs" TO "anon";
GRANT ALL ON TABLE "public"."asset_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_logs" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mass_outages" TO "anon";
GRANT ALL ON TABLE "public"."mass_outages" TO "authenticated";
GRANT ALL ON TABLE "public"."mass_outages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mass_outages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mass_outages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mass_outages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."outage_reports" TO "anon";
GRANT ALL ON TABLE "public"."outage_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."outage_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."outage_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."outage_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."outage_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pause_reasons" TO "anon";
GRANT ALL ON TABLE "public"."pause_reasons" TO "authenticated";
GRANT ALL ON TABLE "public"."pause_reasons" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pause_reasons_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pause_reasons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pause_reasons_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reservations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reservations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reservations_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."seq_inc" TO "anon";
GRANT ALL ON SEQUENCE "public"."seq_inc" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."seq_inc" TO "service_role";



GRANT ALL ON SEQUENCE "public"."seq_req" TO "anon";
GRANT ALL ON SEQUENCE "public"."seq_req" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."seq_req" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_categories_config" TO "anon";
GRANT ALL ON TABLE "public"."ticket_categories_config" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_categories_config" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ticket_categories_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ticket_categories_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ticket_categories_config_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_events" TO "anon";
GRANT ALL ON TABLE "public"."ticket_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ticket_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ticket_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ticket_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_schedules" TO "anon";
GRANT ALL ON TABLE "public"."weekly_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_schedules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."weekly_schedules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."weekly_schedules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."weekly_schedules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."work_sessions" TO "anon";
GRANT ALL ON TABLE "public"."work_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."work_sessions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."work_sessions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."work_sessions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."work_sessions_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































