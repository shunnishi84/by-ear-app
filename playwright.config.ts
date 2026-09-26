import { defineConfig } from '@playwright/test';

// CHROMIUM_PATH lets sandboxes with a preinstalled browser skip `playwright install`.
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
