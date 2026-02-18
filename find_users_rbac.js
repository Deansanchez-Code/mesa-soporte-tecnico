const supabaseUrl = "https://ukoqpikpqzffqieomaoo.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3FwaWtwcXpmZnFpZW9tYW9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDU2MTAyOSwiZXhwIjoyMDgwMTM3MDI5fQ.BQCDHIeu3bkVnAF_VTnQrLgTkOZQNKx4dpCAUkYChME";

async function findUsers() {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/users?or=(email.ilike.%egutierrezn%,email.ilike.%rbiblioteca%,full_name.ilike.%egutierrezn%,full_name.ilike.%rbiblioteca%)`,
    {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    },
  );
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

findUsers();
