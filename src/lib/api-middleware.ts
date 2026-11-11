import { createClient } from "@/lib/supabase/server";
import {
  createClient as createSupabaseClient,
  SupabaseClient,
} from "@supabase/supabase-js";
import { env } from "@/env";
import Logger from "@/lib/logger";

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export type AuthenticatedContext = {
  user: {
    id: string;
    email?: string;
    role?: string;
    user_metadata?: Record<string, unknown>;
  };
  supabase: SupabaseClient;
};

type ApiHandler = (
  req: NextRequest,
  ctx: AuthenticatedContext,
  params?: Record<string, string>,
) => Promise<NextResponse>;

export function withAuth(handler: ApiHandler) {
  return async (
    req: NextRequest,
    props: { params?: Promise<Record<string, string>> } = {},
  ) => {
    try {
      const params = await props.params;
      const cookieSupabase = await createClient();

      // ISO 27001 A.8.5: Validar token contra Auth Server (getUser) en lugar de getSession()
      const {
        data: { user: cookieUser },
      } = await cookieSupabase.auth.getUser();

      let user = cookieUser;
      let activeSupabase: SupabaseClient = cookieSupabase;

      if (!user) {
        const authHeader = req.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice(7).trim();
          if (token) {
            const bearerClient = createSupabaseClient(
              env.NEXT_PUBLIC_SUPABASE_URL,
              env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              {
                global: {
                  headers: { Authorization: `Bearer ${token}` },
                },
                auth: {
                  autoRefreshToken: false,
                  persistSession: false,
                },
              },
            );
            const {
              data: { user: tokenUser },
            } = await bearerClient.auth.getUser(token);
            if (tokenUser) {
              user = tokenUser;
              activeSupabase = bearerClient;
            }
          }
        }
      }

      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing session" },
          { status: 401 },
        );
      }

      // Execute the handler with verified user context
      return await handler(req, { user, supabase: activeSupabase }, params);
    } catch (error: unknown) {
      Logger.error("API Error", error);

      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation Error", details: error.issues },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}
