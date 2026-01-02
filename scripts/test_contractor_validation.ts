async function testContractorValidation() {
  const baseUrl = "http://localhost:3000"; // Ajustar si es necesario

  const testCases = [
    {
      name: "Rechazar correo @sena.edu.co",
      body: {
        username: "test_sena",
        full_name: "Test Sena",
        email: "usuario@sena.edu.co",
        role: "user",
        area: "Test Area",
      },
      expectedStatus: 400,
    },
    {
      name: "Aceptar correo externo (gmail)",
      body: {
        username: "test_gmail_" + Date.now(),
        full_name: "Test Gmail",
        email: "usuario_" + Date.now() + "@gmail.com",
        role: "user",
        area: "Test Area",
      },
      expectedStatus: 200,
    },
  ];

  console.log("=== Iniciando Pruebas de Validación de Contratistas ===");

  for (const tc of testCases) {
    console.log(`\nProbando: ${tc.name}...`);
    try {
      const res = await fetch(`${baseUrl}/api/auth/register-contractor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tc.body),
      });

      console.log(`Status: ${res.status}`);
      const data = await res.json();

      if (res.status === tc.expectedStatus) {
        console.log(`✅ Resultado esperado.`);
        if (res.status === 200) {
          console.log(`Rol final: ${data.user.role} (Debe ser 'contractor')`);
        } else {
          console.log(`Error recibido: ${data.error}`);
        }
      } else {
        console.log(
          `❌ ERROR: Se esperaba status ${tc.expectedStatus} pero se obtuvo ${res.status}`,
        );
        console.log(`Respuesta:`, data);
      }
    } catch (e) {
      console.error(`❌ Fallo en la petición:`, e);
    }
  }
}

testContractorValidation();
