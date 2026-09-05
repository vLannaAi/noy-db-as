import { defineConfig } from 'vitest/config'

// The docs-bridge payload has no `as-*` package to live under, and the root
// config only globs `as-*/vitest.config.ts` — so without this project its tests
// would sit in the tree and never run. That is the failure this whole payload
// exists to avoid, one level up.
export default defineConfig({
  test: {
    name: 'scripts',
    include: ['**/*.test.mjs'],
    root: import.meta.dirname,
  },
})
