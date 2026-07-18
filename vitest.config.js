import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Root-level test run covers backend only.
    // Frontend tests run separately via `npm test` inside rms_frontend/.
    include: ['rms_backend/**/*.test.{js,ts}'],
    exclude: ['node_modules', 'rms_frontend'],
  },
});
