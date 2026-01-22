import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

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

async function listInstructorsHandler() {
  // Query: Role != superadmin AND job_category == 'instructor'
  // Consistent with the original filtering logic.
  let query = supabaseAdmin
    .from("users")
    .select("id, full_name, role, job_category, email")
    .neq("role", "superadmin");

  query = query.or(
    "job_category.eq.instructor,job_category.eq.Instructor,role.eq.instructor",
  );

  const { data, error } = await query.order("full_name");

  if (error) {
    console.error("[API/Instructors] DB Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export const GET = withAuth(listInstructorsHandler);
