-- Función para calcular SLA y detectar VIP
CREATE OR REPLACE FUNCTION calculate_ticket_sla()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Re-crear el trigger (por si acaso no existe o para asegurar que usa la nueva función)
DROP TRIGGER IF EXISTS trigger_calculate_ticket_sla ON tickets;
CREATE TRIGGER trigger_calculate_ticket_sla
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION calculate_ticket_sla();
