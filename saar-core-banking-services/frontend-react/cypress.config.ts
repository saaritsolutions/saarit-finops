import { defineConfig } from 'cypress';

export default defineConfig({
  // Enable recording videos during `cypress run`
  video: true,
  // Improve quality (lower CRF = higher quality, larger files). 20 is a good balance.
  videoCompression: 20,
  // Preserve previous videos instead of deleting them before runs
  trashAssetsBeforeRuns: false,
  e2e: {
    setupNodeEvents(on, config) {
      // Improve clarity on Chromium-based browsers by increasing device scale factor
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium') {
          launchOptions.args.push('--force-device-scale-factor=2');
          launchOptions.args.push('--high-dpi-support=2');
        }
        // Always return launchOptions to satisfy strict return checks
        return launchOptions;
      });

      // Keep a timestamped copy of each video so runs don't overwrite
      on('after:spec', (_spec, results) => {
        if (results && results.video) {
          const fs = require('fs');
          const path = require('path');
          try {
            const dir = path.dirname(results.video);
            const base = path.basename(results.video, '.mp4');
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const stamped = path.join(dir, `${base}.${ts}.mp4`);
            if (fs.existsSync(results.video)) {
              fs.copyFileSync(results.video, stamped);
            }
          } catch {
            // ignore errors during archival
          }
        }
      });
      return config;
    },
    baseUrl: process.env['CYPRESS_BASE_URL'] || 'http://localhost:3002',
    supportFile: 'cypress/support/e2e.ts',
    defaultCommandTimeout: 12000,
    // Higher-resolution viewport for crisper recordings
    viewportWidth: 1920,
    viewportHeight: 1080,
  },
});
