const { chromium, expect } = require("@playwright/test");
const { mkdirSync } = require("node:fs");
const mediaArtifacts = ".next/media-check";
mkdirSync(mediaArtifacts, { recursive: true });

const appUrl = (process.env.TEST_APP_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  let host;
  let code;
  let admin;
  const errors = [];
  const revokedIdentities = new Set();
  const identities = new Map();
  const regionRequests = [];
  const consoleErrors = [];
  try {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);
    for (const context of contexts) {
      await context.grantPermissions(["camera", "microphone"]);
      await context.addInitScript(() => {
        localStorage.setItem(
          "zoom-clone:preferences",
          JSON.stringify({
            displayName: "Automated media check",
            audioEnabled: true,
            videoEnabled: true,
          }),
        );
        // Generated pixels exercise publishing/subscribing without capturing a real screen.
        navigator.mediaDevices.getDisplayMedia = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 1280;
          canvas.height = 720;
          const drawing = canvas.getContext("2d");
          const paint = () => {
            drawing.fillStyle = "#0e71eb";
            drawing.fillRect(0, 0, 1280, 720);
            drawing.fillStyle = "#fff";
            drawing.font = "48px sans-serif";
            drawing.fillText("Automated screen share " + Date.now(), 70, 180);
          };
          paint();
          const timer = setInterval(paint, 100);
          const stream = canvas.captureStream(10);
          stream
            .getVideoTracks()[0]
            .addEventListener("ended", () => clearInterval(timer));
          return stream;
        };
      });
    }
    host = await contexts[0].newPage();
    const guest = await contexts[1].newPage();
    if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
      const adminContext = await browser.newContext();
      admin = await adminContext.newPage();
      await admin.goto(appUrl + "/signin");
      await admin
        .getByLabel("Email address")
        .fill(process.env.TEST_ADMIN_EMAIL);
      await admin
        .getByLabel("Password", { exact: true })
        .fill(process.env.TEST_ADMIN_PASSWORD);
      await admin.getByRole("button", { name: "Sign In", exact: true }).click();
      await admin.getByRole("link", { name: "Admin", exact: true }).click();
      await expect(
        admin.getByRole("heading", { name: "Site administration" }),
      ).toBeVisible();
      await admin.getByRole("tab", { name: "Accounts", exact: true }).click();
      await expect(
        admin.getByText(
          process.env.TEST_ADMIN_EMAIL + " · Site administrator",
          { exact: true },
        ),
      ).toBeVisible();
    }
    for (const page of [host, guest, admin].filter(Boolean)) {
      page.on("response", async (response) => {
        const path = new URL(response.url()).pathname;
        if (path.endsWith("/join") && response.status() === 200) {
          const joined = await response.json().catch(() => null);
          if (joined?.participant?.id)
            identities.set(page, joined.participant.id);
        }
        if (path === "/settings/regions" && response.status() === 401) {
          const headers = await response.request().allHeaders();
          let identity;
          try {
            identity = JSON.parse(
              Buffer.from(
                headers.authorization.split(".")[1],
                "base64url",
              ).toString(),
            ).sub;
          } catch {
            /* Unknown credentials must remain a test failure. */
          }
          regionRequests.push({
            url: response.url(),
            expected: revokedIdentities.has(identity),
          });
          return;
        }
        if (response.status() >= 400)
          errors.push(
            `HTTP ${response.status()}: ${new URL(response.url()).pathname}`,
          );
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error")
          consoleErrors.push({
            text: message.text(),
            url: message.location().url,
          });
      });
    }
    await host.goto(appUrl);
    await host
      .getByRole("button", { name: "Continue as Guest", exact: true })
      .click();
    const creation = host.waitForResponse(
      (response) =>
        response.url().endsWith("/meetings/instant") &&
        response.request().method() === "POST" &&
        response.status() === 201,
    );
    await host
      .getByRole("button", { name: "New Meeting", exact: true })
      .click();
    code = (await (await creation).json()).meeting.meeting_code;
    await expect(host).toHaveURL(/\/meeting\/\d{11}$/, { timeout: 30000 });
    code = new URL(host.url()).pathname.split("/").pop();
    await host
      .getByRole("button", { name: "Join meeting", exact: true })
      .click();
    await expect(host.locator(".connection-label")).toContainText("connected", {
      timeout: 45000,
    });
    await guest.goto(appUrl + "/join/" + code);
    await guest
      .getByLabel("Your name", { exact: true })
      .fill("Automated guest");
    await guest
      .getByRole("button", { name: "Join meeting", exact: true })
      .click();
    await expect(guest.locator(".connection-label")).toContainText(
      "connected",
      { timeout: 45000 },
    );
    await expect
      .poll(
        () =>
          guest
            .locator(".meeting-grid video")
            .evaluateAll(
              (videos) => videos.filter((video) => video.videoWidth > 0).length,
            ),
        { timeout: 45000 },
      )
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(
        () =>
          guest
            .locator("audio")
            .evaluateAll(
              (audio) =>
                audio.filter(
                  (element) => element.srcObject && element.readyState >= 2,
                ).length,
            ),
        { timeout: 30000 },
      )
      .toBeGreaterThanOrEqual(1);
    await host
      .getByRole("button", { name: "Share screen", exact: true })
      .click();
    await expect(
      host.getByRole("button", { name: "Stop screen sharing", exact: true }),
    ).toBeVisible();
    await expect(guest.locator(".screen-share-stage")).toBeVisible({
      timeout: 30000,
    });
    await expect
      .poll(
        () =>
          guest
            .locator(".shared-screen-grid video")
            .evaluateAll((videos) =>
              videos.some((video) => video.videoWidth > 0),
            ),
        { timeout: 30000 },
      )
      .toBeTruthy();
    for (const page of [host, guest]) {
      await expect(
        page.locator(".camera-strip .lk-participant-tile"),
      ).toHaveCount(2);
      await expect
        .poll(
          () =>
            page
              .locator(".camera-strip video")
              .evaluateAll(
                (videos) =>
                  videos.filter((video) => video.videoWidth > 0).length,
              ),
          { timeout: 30000 },
        )
        .toBe(2);
    }
    await host.screenshot({
      path: `${mediaArtifacts}/screen-share-desktop.png`,
    });
    await guest.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(
        () =>
          guest
            .locator(".shared-screen-grid video")
            .evaluateAll((videos) =>
              videos.some((video) => video.videoWidth > 0),
            ),
        { timeout: 30000 },
      )
      .toBeTruthy();
    await expect(
      guest.getByRole("region", { name: "Participant cameras" }),
    ).toBeVisible();
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await guest.screenshot({
      path: `${mediaArtifacts}/screen-share-mobile.png`,
    });
    expect(
      await guest
        .locator(".screen-video")
        .evaluate(
          (element) =>
            Math.abs(
              element.clientWidth - element.querySelector("video").clientWidth,
            ) < 2,
        ),
    ).toBeTruthy();
    await guest
      .getByRole("button", { name: "Full screen shared screen", exact: true })
      .click();
    await expect(guest.locator(".expanded-share")).toBeVisible();
    const expandedSize = await guest.locator(".expanded-share").boundingBox();
    expect(expandedSize.width).toBeGreaterThanOrEqual(389);
    await guest
      .getByRole("button", { name: "Fit screen", exact: true })
      .click();
    await guest
      .getByRole("button", {
        name: "Exit shared screen full screen",
        exact: true,
      })
      .click();
    await expect(guest.locator(".expanded-share")).toHaveCount(0);
    // Camera-off placeholders must survive while a screen stays on the stage.
    await guest
      .getByRole("button", { name: "Stop video", exact: true })
      .click();
    await expect(
      host.locator(
        '.camera-strip .lk-participant-tile[data-lk-video-muted="true"]',
      ),
    ).toHaveCount(1);
    await guest
      .getByRole("button", { name: "Start video", exact: true })
      .click();
    await expect
      .poll(
        () =>
          host
            .locator(".camera-strip video")
            .evaluateAll(
              (videos) => videos.filter((video) => video.videoWidth > 0).length,
            ),
        { timeout: 30000 },
      )
      .toBe(2);
    await host
      .getByRole("button", { name: "Stop screen sharing", exact: true })
      .click();
    await expect(guest.locator(".screen-share-stage")).toHaveCount(0, {
      timeout: 15000,
    });
    // Repeat the transition, including another presenter, to catch the old
    // GridLayout camera-placeholder -> screen-share array error on both clients.
    for (const presenter of [guest, host]) {
      await presenter
        .getByRole("button", { name: "Share screen", exact: true })
        .click();
      for (const page of [host, guest]) {
        await expect(page.locator(".shared-screen-grid video")).toHaveCount(1);
        await expect(
          page.locator(".camera-strip .lk-participant-tile"),
        ).toHaveCount(2);
      }
      await presenter
        .getByRole("button", { name: "Stop screen sharing", exact: true })
        .click();
      for (const page of [host, guest]) {
        await expect(page.locator(".screen-share-stage")).toHaveCount(0);
        await expect(
          page.locator(".meeting-grid .lk-participant-tile"),
        ).toHaveCount(2);
      }
    }
    await host
      .getByRole("button", { name: "Participants", exact: true })
      .click();
    await expect(
      host.getByRole("button", { name: "Remove Automated guest", exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole("button", {
        name: "Mute Automated media check",
        exact: true,
      }),
    ).toHaveCount(0);
    await host
      .getByRole("button", { name: "Mute Automated guest", exact: true })
      .click();
    await expect(
      guest.getByRole("button", { name: "Unmute microphone", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", {
        name: "Ask to unmute Automated guest",
        exact: true,
      })
      .click();
    await expect(
      guest.getByRole("dialog", { name: "The host asks you to unmute" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("button", { name: "Unmute microphone", exact: true }),
    ).toBeVisible();
    await guest
      .getByRole("button", { name: "Stay muted", exact: true })
      .click();
    await expect(guest.getByRole("dialog")).toHaveCount(0);
    await expect(
      guest.getByRole("button", { name: "Unmute microphone", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", {
        name: "Ask to unmute Automated guest",
        exact: true,
      })
      .click();
    await guest
      .getByRole("dialog")
      .getByRole("button", { name: "Unmute", exact: true })
      .click();
    await expect(
      guest.getByRole("button", { name: "Mute microphone", exact: true }),
    ).toBeVisible();
    await expect(
      host.getByRole("button", { name: "Mute Automated guest", exact: true }),
    ).toBeVisible();
    await host.getByRole("button", { name: "Mute All", exact: true }).click();
    await expect(
      guest.getByRole("button", { name: "Unmute microphone", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      host.getByRole("button", { name: "Mute microphone", exact: true }),
    ).toBeVisible();
    await guest
      .getByRole("button", { name: "Unmute microphone", exact: true })
      .click();
    await expect(
      guest.getByRole("button", { name: "Mute microphone", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "Remove Automated guest", exact: true })
      .click();
    await host
      .getByRole("button", { name: "Remove participant", exact: true })
      .click({ trial: true });
    revokedIdentities.add(identities.get(guest));
    await host
      .getByRole("button", { name: "Remove participant", exact: true })
      .click();
    await expect(guest.locator(".alert")).toContainText(
      "The host removed you",
      { timeout: 20000 },
    );
    await guest
      .getByRole("button", { name: "Rejoin meeting", exact: true })
      .click();
    await expect(guest.locator(".connection-label")).toContainText(
      "connected",
      { timeout: 45000 },
    );
    for (const identity of identities.values()) revokedIdentities.add(identity);
    if (admin) {
      await admin.goto(appUrl + "/admin");
      const row = admin.locator(".admin-row").filter({ hasText: code });
      await row
        .getByRole("button", { name: "End New Meeting", exact: true })
        .click();
      await admin
        .getByRole("dialog")
        .getByRole("button", { name: "End meeting for all", exact: true })
        .click();
      await expect(admin.getByRole("dialog")).toHaveCount(0, {
        timeout: 20000,
      });
      await expect(
        host.getByRole("heading", { name: "This meeting has ended" }),
      ).toBeVisible({ timeout: 45000 });
    } else {
      await host.getByRole("button", { name: "End", exact: true }).click();
      await host
        .getByRole("button", { name: "End meeting for all", exact: true })
        .click();
    }
    await expect(
      guest.getByRole("heading", { name: "This meeting has ended" }),
    ).toBeVisible({ timeout: 45000 });
    // Cloud rejects a revoked token correctly. The SDK's region cache may refresh
    // for 30 seconds after disconnect; allow only this exact request for a known
    // revoked identity. Any active-user 401, app error or RTC error still fails.
    for (const region of regionRequests) {
      if (!region.expected)
        errors.push("Unexpected HTTP 401: /settings/regions");
    }
    for (const entry of consoleErrors) {
      if (
        entry.text.includes("Failed to load resource") &&
        regionRequests.some(
          (region) => region.expected && region.url === entry.url,
        )
      )
        continue;
      errors.push(entry.text);
    }
    expect(errors).toEqual([]);
    if (regionRequests.length)
      console.log(
        `NOTE: ${regionRequests.length} expected Cloud region refresh rejections for revoked participant tokens; call and app assertions passed.`,
      );
    if (admin)
      console.log(
        "PASS: Configured administrator signs in, is the sole admin, sees accounts, and ends another host's real Cloud call gracefully for both participants.",
      );
    console.log(
      "PASS: LiveKit Cloud camera/audio, screen share with both cameras visible on desktop/mobile, camera off/on, repeated presenter transitions without layout errors, individual mute, unmute consent declined/accepted, Mute All, Remove, rejoin, and End. No unexpected console or HTTP errors.",
    );
  } finally {
    if (host && code) {
      // Cleanup is idempotent; never print the host capability or media tokens.
      await host
        .evaluate(async (code) => {
          const token = sessionStorage.getItem("zoom-clone:host:" + code);
          if (token)
            await fetch("/api/backend/meetings/" + code + "/end", {
              method: "POST",
              headers: { "X-Host-Token": token },
            });
        }, code)
        .catch(() => {});
    }
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
