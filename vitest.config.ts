import { defineConfig } from 'vitest/config'

// On Windows a lowercase drive letter (c:\ vs C:\) makes Vitest load its runner twice and every suite fails.
export default defineConfig({
  root: process.cwd().replace(/^[a-z]:/, d => d.toUpperCase()),
  test: { include: ['src/**/*.test.ts'] },
})
