import { test, expect } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";

async function openAsGuest(page) {
  await page.goto("/signin");
  await page
    .getByRole("button", { name: "Continue as Guest", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
}

test("sole admin sign-in, account oversight, ending another member's meeting, and denied member access", async ({
  page,
  request,
}) => {
  await request.post("/api/backend/auth/signup", {
    data: {
      display_name: "E2E Site Owner",
      email: "e2e-owner@example.com",
      password: "e2e-admin-password",
    },
  });
  const member = await request.post("/api/backend/auth/signup", {
    data: {
      display_name: "Admin test member",
      email: "admin-member@example.com",
      password: "e2e-member-password",
    },
  });
  const session = await member.json();
  expect(session.user.is_admin).toBe(false);
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const meeting = await (
    await request.post("/api/backend/meetings/instant", {
      headers,
      data: { title: "Administrator test meeting" },
    })
  ).json();
  expect((await request.get("/api/backend/admin/users")).status()).toBe(403);
  expect(
    (await request.get("/api/backend/admin/meetings", { headers })).status(),
  ).toBe(403);
  expect(
    (
      await request.post(
        `/api/backend/admin/meetings/${meeting.meeting.meeting_code}/end`,
        { headers },
      )
    ).status(),
  ).toBe(403);
  await page.goto("/signin");
  await page.getByLabel("Email address").fill("e2e-owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("e2e-admin-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Administrator test meeting",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "End Administrator test meeting",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(
    (
      await (
        await request.get(
          `/api/backend/meetings/${meeting.meeting.meeting_code}`,
        )
      ).json()
    ).status,
  ).toBe("live");
  await page
    .getByRole("button", {
      name: "End Administrator test meeting",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End meeting for all", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "End Administrator test meeting",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    (
      await (
        await request.get(
          `/api/backend/meetings/${meeting.meeting.meeting_code}`,
        )
      ).json()
    ).status,
  ).toBe("ended");
  await page.getByRole("tab", { name: "Accounts", exact: true }).click();
  await expect(
    page.getByText("e2e-owner@example.com · Site administrator", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("admin-member@example.com · Member", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin$/);
  await page
    .getByRole("button", { name: "Continue as Guest", exact: true })
    .click();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveCount(0);
});

test("account signup, isolated calendar, logout, and host recovery after sign-in", async ({
  page,
}) => {
  const email = `interview-${Date.now()}@example.com`;
  await page.goto("/signin");
  await page
    .getByRole("button", { name: "New to Zoom Clone? Sign Up" })
    .click();
  await page.getByLabel("Full name").fill("Interview User");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("simple-secure-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".alert.success")).toContainText("Account created");
  await expect(page).toHaveURL(/\/signin$/);
  await page
    .getByLabel("Password", { exact: true })
    .fill("simple-secure-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Interview User", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Team Standup", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page.getByLabel("Topic", { exact: true }).fill("Account meeting");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Schedule", exact: true })
    .click();
  const invite = await page
    .getByLabel("Invite link", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign In", exact: true }),
  ).toBeVisible();
  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator(".alert")).toContainText(
    "Email or password is incorrect",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill("simple-secure-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Account meeting", exact: true }),
  ).toBeVisible();
  await page.goto(invite);
  await expect(page.getByText("You’re the host")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start meeting", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("malformed saved preferences cannot crash the meeting lobby", async ({
  page,
  request,
}) => {
  const created = await (
    await request.post("http://127.0.0.1:8001/meetings/instant", { data: {} })
  ).json();
  await page.addInitScript(() => {
    localStorage.setItem(
      "zoom-clone:preferences",
      JSON.stringify({
        displayName: { invalid: true },
        audioEnabled: "false",
        videoEnabled: "true",
      }),
    );
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/join/${created.meeting.meeting_code}`);
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
    "Demo User",
  );
  await expect(
    page.getByLabel("Join with microphone on", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Join with camera on", { exact: true }),
  ).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("dashboard, instant invite, unavailable media, and host End", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await openAsGuest(page);
  await expect(
    page.getByText("Meeting server connected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Demo User", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New Meeting", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "New Meeting", exact: true }).click();
  await expect(page).toHaveURL(/\/meeting\/\d{11}$/);
  await expect(page.getByText("You’re the host")).toBeVisible();
  await expect(page.getByLabel("Invite link", { exact: true })).toHaveValue(
    /http:\/\/localhost:3001\/join\/\d{11}$/,
  );
  await page.getByRole("button", { name: "Join meeting", exact: true }).click();
  await expect(page.locator(".alert")).toContainText(
    "Video calling is not available yet",
  );
  await page.getByRole("button", { name: "End meeting", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "This meeting has ended" }),
  ).toBeVisible();
  await expect(errors).toEqual([]);
});

test("schedule, independent guest waiting, host start, and lookup", async ({
  page,
  context,
}) => {
  await openAsGuest(page);
  await expect(
    page.getByText("Meeting server connected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  const title = `Interview planning ${Date.now()}`;
  await page.getByLabel("Topic", { exact: true }).fill(title);
  await page
    .getByLabel("Description (optional)")
    .fill("Simple scheduling flow");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Schedule", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your meeting is scheduled" }),
  ).toBeVisible();
  const invite = await page
    .getByLabel("Invite link", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  const guest = await context.newPage();
  await guest.goto(invite);
  await expect(
    guest.getByRole("heading", { name: "Waiting for the host" }),
  ).toBeVisible();
  await expect(
    guest.getByRole("button", { name: "Start meeting", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".meeting-row")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("link", { name: "Start", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Start meeting", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Join meeting", exact: true }),
  ).toBeVisible();
  await expect(
    guest.getByRole("button", { name: "Join meeting", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await guest.getByLabel("Your name", { exact: true }).fill("Guest Anuj");
  await guest
    .getByRole("button", { name: "Join meeting", exact: true })
    .click();
  await expect(guest.locator(".alert")).toContainText(
    "Video calling is not available yet",
  );
  await page.getByRole("button", { name: "End meeting", exact: true }).click();
  await expect(
    guest.getByRole("heading", { name: "This meeting has ended" }),
  ).toBeVisible({ timeout: 10000 });
  await guest.close();
  await openAsGuest(page);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByLabel("Meeting ID or invite link").fill(invite);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".alert")).toContainText("This meeting has ended");
});

test("profile preferences persist, invalid ID errors, and meeting search", async ({
  page,
}) => {
  await openAsGuest(page);
  await page.goto("/settings");
  await page.getByLabel("Default display name").fill("Anuj");
  await page.getByLabel("Join with microphone on", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toHaveText("Preferences saved.");
  await page.reload();
  await expect(page.getByLabel("Default display name")).toHaveValue("Anuj");
  await expect(
    page.getByLabel("Join with microphone on", { exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByLabel("Meeting ID or invite link").fill("123");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".alert")).toContainText("11-digit meeting ID");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByLabel("Search meetings", { exact: true })
    .fill("there-is-no-meeting-like-this");
  await page.getByLabel("Search meetings", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/meetings\?search=/);
  await expect(
    page.getByRole("heading", { name: "Your calendar is clear" }),
  ).toBeVisible();
  await page.getByLabel("Filter meetings").fill("");
  await expect(
    page.getByRole("heading", { name: "Team Standup", exact: true }),
  ).toBeVisible();
});

test("mobile layout and a disconnected backend", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAsGuest(page);
  await expect(
    page.getByText("Meeting server connected", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.route("**/api/backend/**", (route) => route.abort());
  await page.reload();
  await expect(page.locator(".alert")).toContainText(
    "Cannot reach the meeting server",
  );
});

test("meeting-room controls mount and host End works while media is connecting", async ({
  page,
  request,
}) => {
  // Only this test stubs a media grant/socket. No call is simulated in the app.
  // This catches client-only SDK/rendering errors without requiring Cloud secrets.
  // Model a phone browser that can receive media but cannot capture a screen.
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      value: undefined,
      configurable: true,
    });
  });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.routeWebSocket("ws://localhost:9999/**", () => {});
  await page.route("**/meetings/*/join", async (route) => {
    const code = new URL(route.request().url()).pathname.match(
      /\/meetings\/([0-9]{11})\/join$/,
    )[1];
    const meeting = await (
      await request.get(`http://127.0.0.1:8001/meetings/${code}`)
    ).json();
    const participant = {
      id: randomUUID(),
      display_name: "Demo User",
      role: "host",
      joined_at: null,
      left_at: null,
    };
    const issued = Math.floor(Date.now() / 1000);
    const head = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        iss: "test-key",
        sub: participant.id,
        name: participant.display_name,
        nbf: issued,
        exp: issued + 300,
        video: {
          roomJoin: true,
          room: meeting.room_name,
          canPublish: true,
          canSubscribe: true,
        },
      }),
    ).toString("base64url");
    const signature = createHmac(
      "sha256",
      "test-only-secret-for-local-ui-verification",
    )
      .update(`${head}.${body}`)
      .digest("base64url");
    await route.fulfill({
      json: {
        participant,
        participant_token: "test-only-attendance-token",
        livekit_token: `${head}.${body}.${signature}`,
        livekit_url: "ws://localhost:9999",
        room_name: meeting.room_name,
      },
    });
  });
  await page.route("**/meetings/*/leave", (route) =>
    route.fulfill({ json: {} }),
  );
  await openAsGuest(page);
  await page.getByRole("button", { name: "New Meeting", exact: true }).click();
  await page.getByLabel("Join with microphone on", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Join meeting", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Participants", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Share screen", exact: true }).click();
  await expect(page.locator(".room-notice")).toContainText(
    "This browser cannot share its screen",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 844, height: 390 });
  const toolbar = await page.locator(".meeting-toolbar").boundingBox();
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(391);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Participants", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Participants \(/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/meeting-room-connecting.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Invite participants", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Invite people to your meeting" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page
    .getByRole("button", { name: "End meeting for all", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "This meeting has ended" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("sign-in validates input and accepts password-manager field values", async ({
  page,
  request,
}) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator(".alert")).toContainText(
    "Enter a valid email address",
  );
  await page.getByLabel("Email address").fill("unknown@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator(".alert")).toContainText("at least 8 characters");
  await page.getByLabel("Password", { exact: true }).fill("invalid-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator(".alert")).toContainText(
    "Email or password is incorrect",
  );
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeEnabled();
  const email = `autofill-${randomUUID()}@example.com`;
  const password = "autofill-test-password";
  const signup = await request.post("/api/backend/auth/signup", {
    data: { display_name: "Autofill User", email, password },
  });
  expect(signup.status()).toBe(201);
  await page.evaluate(
    ({ email, password }) => {
      document.getElementById("account-email").value = email;
      document.getElementById("account-password").value = password;
    },
    { email, password },
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Autofill User", exact: true }),
  ).toBeVisible();
});

test("new visitors see Sign In first and explicitly enter guest mode", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(
    page.getByRole("heading", { name: "Sign In", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New Meeting", exact: true }),
  ).toHaveCount(0);
  await page.goto("/meetings");
  await expect(page).toHaveURL(/\/signin$/);
  await page
    .getByRole("button", { name: "Continue as Guest", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Demo User", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "New Meeting", exact: true }),
  ).toBeVisible();
  await page.goto("/meetings");
  await expect(
    page.getByRole("heading", { name: "Meetings", exact: true, level: 1 }),
  ).toBeVisible();
  await page.evaluate(() => sessionStorage.removeItem("zoom-clone:guest"));
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/signin$/);
});
