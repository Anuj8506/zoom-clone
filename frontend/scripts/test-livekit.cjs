const { chromium, expect } = require("@playwright/test");

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
  const errors = [];
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
    for (const page of [host, guest])
      page.on("pageerror", (error) => errors.push(error.message));
    await host.goto(appUrl);
    await host
      .getByRole("button", { name: "New Meeting", exact: true })
      .click();
    await expect(host).toHaveURL(/\/meeting\/\d{11}$/);
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
            .locator(".screen-share-stage video")
            .evaluateAll((videos) =>
              videos.some((video) => video.videoWidth > 0),
            ),
        { timeout: 30000 },
      )
      .toBeTruthy();
    await guest.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(
        () =>
          guest
            .locator(".screen-share-stage video")
            .evaluateAll((videos) =>
              videos.some((video) => video.videoWidth > 0),
            ),
        { timeout: 30000 },
      )
      .toBeTruthy();
    await host
      .getByRole("button", { name: "Stop screen sharing", exact: true })
      .click();
    await expect(guest.locator(".screen-share-stage")).toHaveCount(0, {
      timeout: 15000,
    });
    await host.getByRole("button", { name: "End", exact: true }).click();
    await host
      .getByRole("button", { name: "End meeting for all", exact: true })
      .click();
    await expect(
      guest.getByRole("heading", { name: "This meeting has ended" }),
    ).toBeVisible({ timeout: 45000 });
    expect(errors).toEqual([]);
    console.log(
      "PASS: LiveKit Cloud two-person connection, generated camera/audio reception, generated screen share, phone viewport reception, stop share, and host End. No browser runtime errors.",
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
