import { expect, test } from "@playwright/test";

test("login offers Google and GitHub provider sign-in", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Authentication required." } }),
  );

  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Continue with Google" }),
  ).toHaveAttribute("href", "http://localhost:8000/api/auth/google");
  await expect(
    page.getByRole("link", { name: "Continue with GitHub" }),
  ).toHaveAttribute("href", "http://localhost:8000/api/auth/github");
});

test("user registers, verifies email, signs in, and creates a workspace", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Authentication required." } }),
  );
  await page.route("**/api/auth/signup", (route) =>
    route.fulfill({
      status: 201,
      json: { message: "Check your email to verify your account." },
    }),
  );
  await page.route("**/api/auth/verify-email", (route) =>
    route.fulfill({
      status: 200,
      json: { message: "Email verified. You can sign in." },
    }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 200,
      json: {
        user: {
          id: "user-1",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        },
      },
    }),
  );
  await page.route("**/api/workspaces", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, json: { workspaces: [] } });
    }

    return route.fulfill({
      status: 201,
      json: {
        workspace: {
          id: "workspace-1",
          name: "Analytical Engine",
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New here? Create account" }).click();
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");

  await page.goto("/?verify=verification-token");
  await expect(page.getByRole("status")).toContainText("Email verified");

  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Workspace name").fill("Analytical Engine");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByText("Analytical Engine")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Workspace created.");
});

test("signup email failure offers verification resend for the created account", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Authentication required." } }),
  );
  await page.route("**/api/auth/signup", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error:
          "Account created, but verification email could not be sent. Request a new email.",
      },
    }),
  );
  await page.route("**/api/auth/request-email-verification", (route) =>
    route.fulfill({
      status: 200,
      json: {
        message: "If an account exists for that email, we sent instructions.",
      },
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "New here? Create account" }).click();
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("could not be sent");
  await expect(page.getByLabel("Email")).toHaveValue("ada@example.com");
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("status")).toContainText("sent instructions");
});
