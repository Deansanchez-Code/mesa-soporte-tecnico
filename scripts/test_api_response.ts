import fetch from "node-fetch";

async function testApi() {
  try {
    console.log("Testing /api/auth/register-contractor...");
    const res = await fetch(
      "http://localhost:3000/api/auth/register-contractor",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser_" + Date.now(),
          full_name: "Test User",
          email: "test@example.com",
          role: "user",
          area: "Test Area",
        }),
      }
    );

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body snippet:", text.substring(0, 500)); // Print first 500 chars to see if it's HTML
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

testApi();
