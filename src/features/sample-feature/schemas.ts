import { z } from "zod";

export const baseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
});
