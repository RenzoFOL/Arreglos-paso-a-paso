import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }, viewport: { width: 1366, height: 900 }, screenshot: 'only-on-failure' },
  webServer: [
    { command: 'python -m uvicorn app.main:app --port 8000', cwd: '../back', url: 'http://127.0.0.1:8000/api/health', env: { STUDY_MODE:'true' }, reuseExistingServer: !process.env.CI },
    { command: 'npm run dev -- --mode study --port 5173 --host 127.0.0.1', url:'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  ],
})
