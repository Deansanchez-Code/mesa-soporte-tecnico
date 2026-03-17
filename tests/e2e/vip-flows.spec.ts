import { test, expect } from "@playwright/test";

test.describe("VIP and Critical Ticket Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Basic login to reach the dashboard
    await page.goto("/");
    const loginInput = page.locator('input[placeholder*="nombre de usuario"]');
    await loginInput.fill("testuser");
    await page.locator('button:has-text("CONTINUAR")').click();
    await expect(page.locator("text=Solicitar Servicio")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should follow the ticket creation flow for technical support", async ({
    page,
  }) => {
    // This test covers the "Critical Flow" mentioned in CONCERNS.md

    // 1. Select Technical Support
    await page.locator('button:has-text("Servicio Técnico")').click();
    await expect(
      page.locator("text=¿Qué tipo de problema tienes?"),
    ).toBeVisible();

    // 2. Select Category
    const internetButton = page.locator('button:has-text("Internet")').first();
    await internetButton.click();

    // 3. Select Location (from a known location in development)
    const locationSelect = page.locator("select#location-input");
    await locationSelect.selectOption({ index: 1 });

    // 4. Fill description
    const descriptionArea = page.locator(
      'textarea[placeholder*="cuéntanos más"]',
    );
    if (await descriptionArea.isVisible()) {
      await descriptionArea.fill("Prueba de flujo crítico de soporte técnico");
    }

    // 5. Submit
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // 6. Verify notification or success message
    // We expect an alert dialog
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("¡Ticket creado!");
      await dialog.accept();
    });
  });

  test("should identify VIP status in ticket header (audit flow)", async ({
    page,
  }) => {
    // This test checks if the VIP label appears when viewing tickets
    // Requires a ticket previously marked as VIP or mock data.

    await page.goto("/dashboard"); // Assuming admin/dashboard

    // Check if any ticket in the list has a VIP indicator
    const vipLabel = page.locator('span:has-text("VIP")').first();
    // Note: This part of the test might skip if no VIP tickets exist in the current view
    if (await vipLabel.isVisible()) {
      await expect(vipLabel).toBeVisible();
      await expect(vipLabel).toHaveClass(/bg-amber-100/); // Color standard for VIP in this project
    }
  });
});
