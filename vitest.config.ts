import { defineConfig } from 'vitest/config';

// The current suite covers pure logic (event detection and message rendering),
// so it runs on the default Node pool. When we add tests that touch D1 or the
// Worker runtime, introduce a second project using @cloudflare/vitest-plugin.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
