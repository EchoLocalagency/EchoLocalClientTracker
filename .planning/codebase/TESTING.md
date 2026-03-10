# Testing Patterns

**Analysis Date:** 2026-03-10

## Test Framework

**Runner:**
- No test framework is configured
- No `jest.config.*`, `vitest.config.*`, or any test runner config exists
- No test files exist in the `src/` directory

**Assertion Library:**
- None installed

**Run Commands:**
```bash
# No test commands exist in package.json
# Only available scripts: dev, build, start, lint
npm run lint              # ESLint only
npm run build             # Type-checks via TypeScript during build
```

## Test File Organization

**Location:**
- No test files exist anywhere in the project (outside of `node_modules`)

**Naming:**
- No conventions established

## Current Quality Assurance

The project relies on the following non-test quality gates:

**TypeScript strict mode:**
- `tsconfig.json` has `"strict": true`
- Build-time type checking catches type errors during `npm run build`

**ESLint:**
- `eslint.config.mjs` extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Catches React-specific issues (hooks rules, accessibility)
- Run via `npm run lint`

**Manual/visual testing:**
- Mock data exists in `src/lib/mock-data.ts` for development without live Supabase connection
- This suggests the development workflow involves visual verification in the browser

## Recommended Test Setup

When adding tests to this project, use the following approach:

**Framework recommendation:** Vitest (aligns with Next.js ecosystem, faster than Jest)

**Installation:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Config (`vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Priority areas for testing:**

1. **Utility functions** (`src/lib/utils.ts`) -- pure functions, easiest to test:
   - `calcDelta`, `formatDelta`, `formatNumber`, `formatPosition`
   - `dailyRate`, `rollingSum14`
   - `calcHealthScore`, `calcVelocity`
   - `parseMetricValue`

2. **Custom hooks** (`src/hooks/useFilteredReports.ts`) -- filter/sort logic

3. **API routes** (`src/app/api/webhook/ghl-form/route.ts`, `src/app/api/agents/*/route.ts`) -- mock Supabase client, test request/response

## Mocking

**What to mock (when tests are added):**
- Supabase client: Mock `@supabase/supabase-js` and `@supabase/ssr`
- `process.env` values for API keys
- `next/navigation` hooks (`useRouter`, `useSearchParams`)

**What NOT to mock:**
- Utility functions in `src/lib/utils.ts` (test these directly)
- Type definitions
- CSS/styling

## Coverage

**Requirements:** None enforced. No coverage thresholds configured.

**Current coverage:** 0% -- no tests exist.

**Recommended initial targets:**
- `src/lib/utils.ts` -- 100% (pure functions)
- `src/hooks/useFilteredReports.ts` -- 100% (pure logic)
- `src/app/api/*/route.ts` -- core happy path + error cases

## Test Types

**Unit Tests:**
- Not implemented. Should target `src/lib/utils.ts` and `src/hooks/`

**Integration Tests:**
- Not implemented. Should target API routes in `src/app/api/`

**E2E Tests:**
- Not implemented. No Playwright or Cypress config.

## Testable Code Inventory

**Pure functions (highest test priority):**
- `src/lib/utils.ts`: `dailyRate()`, `rollingSum14()`, `calcDelta()`, `formatDelta()`, `formatNumber()`, `formatPosition()`, `parseMetricValue()`, `calcHealthScore()`, `calcVelocity()`

**Custom hooks:**
- `src/hooks/useFilteredReports.ts`: `useFilteredReports()` -- time range filtering + sorting

**API routes:**
- `src/app/api/webhook/ghl-form/route.ts`: POST webhook handler
- `src/app/api/agents/tasks/route.ts`: CRUD operations
- `src/app/api/agents/chat/route.ts`: GET agent data
- `src/app/api/agents/instantly-stats/route.ts`: Stats fetching
- `src/app/api/agents/linkedin-drafts/route.ts`: Draft retrieval

**Components (lower priority, require rendering setup):**
- `src/components/StatCard.tsx`: Display logic with delta calculation
- `src/components/AlertBanner.tsx`: Conditional rendering based on alert severity
- `src/components/TabNav.tsx`: Tab visibility based on admin role

---

*Testing analysis: 2026-03-10*
