const supabaseUrl = "https://ukoqpikpqzffqieomaoo.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3FwaWtwcXpmZnFpZW9tYW9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDU2MTAyOSwiZXhwIjoyMDgwMTM3MDI5fQ.BQCDHIeu3bkVnAF_VTnQrLgTkOZQNKx4dpCAUkYChME";

async function listAreas() {
  const response = await fetch(`${supabaseUrl}/rest/v1/areas?select=*`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

listAreas();
