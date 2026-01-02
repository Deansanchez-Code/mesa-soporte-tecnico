import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

import { getUserFromRequest, unauthorized } from "@/lib/auth-check";
// ... imports

export async function GET(request: NextRequest) {
  try {
    // console.log("[API/Instructors] Request received");

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // ... error handling
      return NextResponse.json(
        { error: "Server Config Error" },
        { status: 500 },
      );
    }

    // 1. Security Check
    const user = await getUserFromRequest(request);
    if (!user) {
      console.warn("[API/Instructors] Unauthorized access attempt");
      return unauthorized();
    }

    console.log("[API/Instructors] User Authenticated:", user.email);

    // 2. Fetch Instructors Only
    // Assuming 'instructor' is stored in lower case. Use .ilike() if unsure, or specific logic.
    // Based on user feedback: "ya carga usuarios pero solo debe cargar instructores"

    // Query: Role != superadmin AND job_category == 'instructor'
    // Depending on data quality, we might also want to include those with role='instructor' if that existed.
    // But 'job_category' seems to be the source of truth now.

    let query = supabaseAdmin
      .from("users")
      .select("id, full_name, role, job_category, email")
      .neq("role", "superadmin");

    // Apply strict filtering for instructors to avoid showing random users in the assignments modal
    query = query.or(
      "job_category.eq.instructor,job_category.eq.Instructor,role.eq.instructor",
    );

    const { data, error } = await query.order("full_name");

    if (error) {
      console.error("[API/Instructors] DB Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // console.log(`[API/Instructors] Found ${data?.length} users.`);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[API/Instructors] Unhandled Exception:", err);
    let errorMessage = "Internal Server Error";
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
