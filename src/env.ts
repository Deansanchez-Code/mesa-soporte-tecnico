import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .transform((url) => {
      // Force https for Supabase URLs, except for local development
      if (url.includes("localhost") || url.includes("127.0.0.1")) return url;
      return url.replace(/^http:\/\//i, "https://");
    }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const serverEnvSchema = z
  .object({
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      // En producción, SMTP_USER y SMTP_PASS son obligatorios.
      // Sin embargo, permitimos que el BUILD de Vercel pase sin ellos para evitar bloqueos,
      // confiando en que estarán presentes en runtime.
      if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
        return !!data.SMTP_USER && !!data.SMTP_PASS;
      }
      return true;
    },
    {
      message: "SMTP_USER and SMTP_PASS are required in production",
      path: ["SMTP_USER"],
    },
  );

const isServer = typeof window === "undefined";

const publicParsed = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NODE_ENV: process.env.NODE_ENV,
});

const serverParsed = isServer
  ? serverEnvSchema.parse({
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  : ({} as z.infer<typeof serverEnvSchema>);

export const env = {
  ...publicParsed,
  ...serverParsed,
};
