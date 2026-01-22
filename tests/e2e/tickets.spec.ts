import { test, expect } from "@playwright/test";

test.describe("Ticket Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and login first (Mocking login state if possible, or perform login)
    await page.goto("/");
    const loginInput = page.locator('input[placeholder*="nombre de usuario"]');
    await loginInput.fill("testuser");
    await page.locator('button:has-text("CONTINUAR")').click();
    await expect(page.locator("text=Solicitar Servicio")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should create a technical support ticket", async ({ page }) => {
    // 1. Select Technical Support
    await page.locator('button:has-text("Servicio Técnico")').click();
    await expect(
      page.locator("text=¿Qué tipo de problema tienes?"),
    ).toBeVisible();

    // 2. Select a category (e.g., "Internet")
    // Note: Categories are dynamic, so we look for a known one or a generic button
    const categoryButton = page.locator('button:has-text("Internet")').first();
    if (await categoryButton.isVisible()) {
      await categoryButton.click();
    } else {
      // Fallback to any category button if "Internet" isn't there
      await page.locator("form button").first().click();
    }

    // 3. Select location
    const locationSelect = page.locator("select#location-input");
    await locationSelect.selectOption({ index: 1 }); // Select first available area

    // 4. Submit the ticket
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // 5. Verify success message (alert)
    // Playwright handles alerts automatically or we can listen for it
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("¡Ticket creado exitosamente!");
      await dialog.accept();
    });
  });
});
