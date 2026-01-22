import { createClient } from "@/lib/supabase/servidor";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export type AuthenticatedContext = {
  user: {
    id: string;
    email?: string;
    role?: string;
    user_metadata?: any;
  };
  supabase: any; // SupabaseClient type
};

type ApiHandler = (
  req: NextRequest,
  ctx: AuthenticatedContext,
  params?: any,
) => Promise<NextResponse>;

export function withAuth(handler: ApiHandler) {
  return async (req: NextRequest, { params }: { params?: any } = {}) => {
    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return NextResponse.json(
          { error: "Unauthorized: Missing session" },
          { status: 401 },
        );
      }

      const user = session.user;

      // Execute the handler with user context
      return await handler(req, { user, supabase }, params);
    } catch (error: any) {
      console.error("API Error:", error);

      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation Error", details: error.issues },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: error.message || "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}
