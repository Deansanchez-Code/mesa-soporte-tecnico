import { z } from "zod";

export const ReservationSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  user_id: z.string().uuid(),
  auditorium_id: z.string().optional(),
  resources: z.array(z.string()).optional().nullable(),
  description: z.string().optional().nullable(),
});
