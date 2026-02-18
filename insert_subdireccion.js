const supabaseUrl = "https://ukoqpikpqzffqieomaoo.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3FwaWtwcXpmZnFpZW9tYW9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDU2MTAyOSwiZXhwIjoyMDgwMTM3MDI5fQ.BQCDHIeu3bkVnAF_VTnQrLgTkOZQNKx4dpCAUkYChME";

async function insertSubdireccion() {
  const response = await fetch(`${supabaseUrl}/rest/v1/areas`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: "SUBDIRECCIÓN DE CENTRO",
    }),
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

insertSubdireccion();
