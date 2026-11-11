import { SpaceCoordinatorAssignment } from "./types";

/**
 * Coordinadores institucionales predeterminados por ambiente especial
 * ("3": Biblioteca, "4": Ambiente 107, "5": Ambiente de Cocina).
 * Se define fuera de módulos "use server" para cumplir la regla de Next.js
 * de exportar únicamente funciones asíncronas desde Server Actions.
 */
export const DEFAULT_SPACE_COORDINATORS: Record<
  string,
  SpaceCoordinatorAssignment
> = {
  "3": {
    user_id: "",
    username: "egutierrezn",
    email: "egutierrezn@sena.edu.co",
    full_name: "Esperanza Gutiérrez Numpaque",
    is_vip: true,
  },
  "4": {
    user_id: "",
    username: "nbarrerac",
    email: "nbarrerac@sena.edu.co",
    full_name: "Nury Mildret Barrera",
    is_vip: true,
  },
  "5": {
    user_id: "",
    username: "nbarrerac",
    email: "nbarrerac@sena.edu.co",
    full_name: "Nury Mildret Barrera",
    is_vip: true,
  },
};
