import { test, expect } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";

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
    page.getByRole("heading", { name: "Demo User", exact: true }),
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
  await page.goto("/");
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
  await page.goto("/");
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
  await page.goto("/");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByLabel("Meeting ID or invite link").fill(invite);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".alert")).toContainText("This meeting has ended");
});

test("profile preferences persist, invalid ID errors, and meeting search", async ({
  page,
}) => {
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
  await page.goto("/");
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
  await page.goto("/");
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
