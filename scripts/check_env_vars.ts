import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

console.log("Checking Environment Variables...");
console.log(
  "NEXT_PUBLIC_SUPABASE_URL:",
  process.env.NEXT_PUBLIC_SUPABASE_URL ? "DEFINED" : "MISSING"
);
console.log(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY:",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "DEFINED" : "MISSING"
);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "DEFINED" : "MISSING"
);
