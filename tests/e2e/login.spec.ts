import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
  test("should allow corporate login with valid username", async ({ page }) => {
    // Navigate to the home page
    await page.goto("/");

    // Check for the corporate login input
    const loginInput = page.locator('input[placeholder*="nombre de usuario"]');
    await expect(loginInput).toBeVisible();

    // Fill in a test username (assuming 'testuser' exists or the mock works)
    // Note: In a real test environment, we would use a seeded test user.
    await loginInput.fill("testuser");

    // Click the "Continuar" button
    const continueButton = page.locator('button:has-text("CONTINUAR")');
    await continueButton.click();

    // In a real test, we would wait for navigation or a state change.
    // Since this is a production-like environment, we might not have 'testuser'
    // but we can at least verify if the loading state or error message appears.

    // Check if we reached the request selection view
    // (This depends on the user existing in Supabase)
    // For now, let's verify if the "Cargando..." state shows up.
    await expect(page.locator("text=Solicitar Servicio")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show contractor registration form", async ({ page }) => {
    await page.goto("/");

    // Find and click the contractor link
    const contractorLink = page.locator('button:has-text("haz clic aquí")');
    await contractorLink.click();

    // Verify the contractor form is visible
    await expect(
      page.locator('h2:has-text("Identificación de Contratista")'),
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="Nombre Completo"]'),
    ).toBeVisible();
  });
});
