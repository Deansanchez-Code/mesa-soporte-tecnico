-- SCRIPT DE ACTUALIZACIÓN DE ESQUEMA
-- Ejecuta este script en el Editor SQL de Supabase para soportar las nuevas funcionalidades.

-- 1. Agregar columna 'solution' para guardar la solución detallada
alter table public.tickets 
add column if not exists solution text;

-- 2. Asegurar que existe 'updated_at' para el archivado automático
alter table public.tickets 
add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- 3. Crear función y trigger para actualizar 'updated_at' automáticamente
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_updated on public.tickets;
create trigger handle_tickets_updated
  before update on public.tickets
  for each row
  execute procedure public.handle_updated_at();

-- 4. Agregar columna 'description' si no existe (para comentarios)
alter table public.tickets 
add column if not exists description text;
