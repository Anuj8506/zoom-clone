import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: "msedge",
    baseURL: "http://localhost:3001",
    viewport: { width: 1365, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        '".venv\\Scripts\\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8001',
      cwd: "../backend",
      url: "http://127.0.0.1:8001/health",
      env: {
        DATABASE_URL: `sqlite:///./data/frontend-e2e-${Date.now()}.db`,
        FRONTEND_URL: "http://localhost:3001",
        CORS_ORIGINS: "http://localhost:3001",
        LIVEKIT_URL: "",
        LIVEKIT_API_KEY: "",
        LIVEKIT_API_SECRET: "",
      },
      timeout: 30000,
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev --hostname localhost --port 3001",
      url: "http://localhost:3001",
      env: {
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:8001",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      timeout: 120000,
    },
  ],
});
