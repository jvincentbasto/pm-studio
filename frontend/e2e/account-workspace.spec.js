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
  const workspaces = [];
  await page.route("**/api/workspaces", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, json: { workspaces } });
    }

    const workspace = {
      id: "workspace-1",
      name: "Analytical Engine",
      owner: "user-1",
      members: [{ id: "user-1", role: "owner" }],
      invitations: [],
    };
    workspaces.push(workspace);
    return route.fulfill({
      status: 201,
      json: { workspace },
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
  await expect(
    page.getByRole("heading", { name: "Analytical Engine" }),
  ).toBeVisible();
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

test("workspace owner invites by email, revokes invitations, and removes members", async ({
  page,
}) => {
  const workspace = {
    id: "workspace-1",
    name: "Analytical Engine",
    owner: "owner-1",
    members: [
      {
        id: "owner-1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        role: "owner",
      },
      {
        id: "member-1",
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace@example.com",
        role: "member",
      },
    ],
    invitations: [],
  };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      json: {
        user: {
          id: "owner-1",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        },
      },
    }),
  );
  await page.route("**/api/workspaces**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ status: 200, json: { workspaces: [workspace] } });
    }
    if (method === "POST" && url.pathname.endsWith("/invitations")) {
      const { email } = route.request().postDataJSON();
      workspace.invitations.push({ id: "invite-1", email });
      return route.fulfill({
        status: 201,
        json: { invitation: { id: "invite-1", email } },
      });
    }
    if (method === "DELETE" && url.pathname.endsWith("/invitations/invite-1")) {
      workspace.invitations = [];
      return route.fulfill({
        status: 200,
        json: { message: "Invitation revoked." },
      });
    }
    if (method === "DELETE" && url.pathname.endsWith("/members/member-1")) {
      workspace.members = workspace.members.filter(
        ({ id }) => id !== "member-1",
      );
      return route.fulfill({
        status: 200,
        json: { message: "Workspace member removed." },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: "Unexpected request." },
    });
  });

  await page.goto("/");

  await expect(page.getByText("Grace Hopper", { exact: true })).toBeVisible();
  await page
    .getByLabel("Invite email for Analytical Engine")
    .fill("grace@example.com");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("grace@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Revoke invitation" }).click();
  await expect(page.getByText("No pending invitations.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove Grace Hopper" }).click();
  await expect(page.getByText("Grace Hopper", { exact: true })).toHaveCount(0);
});

test("signed-in invitee accepts invitation link", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      json: {
        user: {
          id: "member-1",
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@example.com",
        },
      },
    }),
  );
  let acceptedToken;
  await page.route("**/api/workspaces**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/workspaces/invitations/accept") {
      acceptedToken = route.request().postDataJSON().token;
      return route.fulfill({
        status: 200,
        json: { message: "Workspace invitation accepted." },
      });
    }
    return route.fulfill({
      status: 200,
      json: {
        workspaces: [
          {
            id: "workspace-1",
            name: "Analytical Engine",
            owner: "owner-1",
            members: [
              {
                id: "member-1",
                firstName: "Grace",
                lastName: "Hopper",
                email: "grace@example.com",
                role: "member",
              },
            ],
            invitations: [],
          },
        ],
      },
    });
  });

  const token = "a".repeat(64);
  await page.goto(`/?invite=${token}`);

  await expect(page.getByRole("status")).toContainText(
    "Workspace invitation accepted.",
  );
  await expect(
    page.getByRole("heading", { name: "Analytical Engine" }),
  ).toBeVisible();
  expect(acceptedToken).toBe(token);
});
