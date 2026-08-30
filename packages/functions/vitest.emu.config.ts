import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.emu.test.ts'],
    exclude: ['node_modules', 'dist'],
    fileParallelism: false,
  },
});
