import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@pastrypal.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Admin123!";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(ADMIN_EMAIL);
  await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard|\/employees|\/me/);
});

test("login redirects to an authenticated area", async ({ page }) => {
  await expect(page.getByRole("link", { name: "Employees" })).toBeVisible();
});

test("create employee shows validation messages on invalid submit", async ({ page }) => {
  await page.goto("/employees");
  await expect(page.getByRole("heading", { name: "Add Employee" })).toBeVisible();

  await page.getByPlaceholder("First Name").fill("   ");
  await page.getByPlaceholder("Last Name").fill("   ");
  await page.getByPlaceholder("Contact Number").fill("abc");
  await page.getByPlaceholder("Enter 6-digit PIN", { exact: true }).fill("123456");
  await page.getByPlaceholder("Re-enter 6-digit PIN", { exact: true }).fill("654321");

  let dialogMessage = "";
  page.once("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });

  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByText("First name is required.")).toBeVisible();
  await expect(page.getByText("Last name is required.")).toBeVisible();
  await expect(page.getByText("Contact number must be 7-20 characters and contain valid phone symbols.")).toBeVisible();
  await expect(page.getByText("Passkey is too common.")).toBeVisible();
  await expect(page.getByText("Passkeys do not match.")).toBeVisible();
  expect(dialogMessage).toContain("Please complete all required fields correctly.");
});

test("role management supports create, deactivate, activate, and delete", async ({ page }) => {
  await page.goto("/employees");
  const roleSection = page.locator(".card").filter({ hasText: "Role Management" }).first();
  await expect(roleSection).toBeVisible();

  const roleName = `E2E Role ${Date.now()}`;
  await roleSection.getByPlaceholder("New role name").fill(roleName);
  await roleSection.getByRole("button", { name: "Add Role" }).click();

  const roleCard = roleSection
    .locator("div.rounded-lg.border.border-slate-200.p-3")
    .filter({ hasText: roleName })
    .first();

  await expect(roleCard).toContainText(roleName);
  await expect(roleCard.getByText("Active")).toBeVisible();

  await roleCard.getByRole("button", { name: "Deactivate" }).click();
  await expect(roleCard.getByText("Inactive")).toBeVisible();

  await roleCard.getByRole("button", { name: "Activate" }).click();
  await expect(roleCard.getByText("Active")).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await roleCard.getByRole("button", { name: "Delete" }).click();

  await expect(roleSection.getByText(roleName)).not.toBeVisible();
});
