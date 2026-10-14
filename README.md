# Latihan Pauli & Kraepelin

Frontend-only practice app for timed Pauli and Kraepelin addition tests. No accounts, backend, or database. Deployable as a static Next.js app (Vercel free tier).

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest engine tests
```

## Structure

- `src/lib/test/` holds the test engine, free of React:
  - `sheet.ts`: digit generation (seeded, deterministic), work direction, and answer positions. Change the sheet format here.
  - `session.ts`: pure reducer. Time is derived from timestamps (`elapsedMs` + `now - runningSince`), never from counted ticks.
  - `score.ts`: result calculation. `storage.ts`: sessionStorage persistence with validation.
  - `store.ts`: per-test client store (`useSyncExternalStore`) plus a shared clock hook.
- `src/components/` contains the UI. `test-runner.tsx` is the active test screen.

## Format assumptions (confirm against your target format)

All live in `src/lib/test/sheet.ts`, `config.ts`, and `session.ts`:

- Digits are 1 to 9 (no 0). The answer is the last digit of each adjacent sum.
- Pauli adds top to bottom. One countdown covers the whole sheet; the next column opens when the current one is full. The sheet is finite (columns × digits per column) and the test ends early if every position is answered.
- Kraepelin adds bottom to top. Each column has its own time slot; the active column follows the clock and earlier columns lock. A column finished early waits for its slot to end; filling the last column ends the test.
- Backspace undoes the last answer, only within the column that is still open.
- Pause is a practice convenience (official administration typically has none). It freezes both the total and the Kraepelin column clock and hides the digits.
- Completion is answered ÷ all positions on the sheet, so on a large Pauli sheet it is expected to be low. Accuracy is correct ÷ answered.

## Limitations

- Results are raw practice statistics. They are not standardized, normed, or suitable for clinical or hiring decisions.
- Timing and scoring run in the browser. There is no server-side verification or anti-cheating; anyone can edit `sessionStorage`. Validation only rejects data the app itself could not have produced.
- Timing uses the device clock (`Date.now()`). Changing the system clock during a test shifts the remaining time; a start time more than a minute in the future is treated as invalid.
- Sessions live in `sessionStorage`: they survive a reload but not closing the tab. Browsers copy `sessionStorage` when a tab is duplicated, so a duplicated tab continues an independent copy of the session.

## Deploying to Vercel

No backend, database, API routes, middleware, or environment variables. Every route is prerendered as static.

1. Push the project to a Git repository (GitHub, GitLab, or Bitbucket).
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the detected defaults: framework **Next.js**, install `npm install`, build `next build`, output handled by Vercel. Node.js 20.9 or newer.
4. Deploy. No environment variables are needed.

Alternatively, with the Vercel CLI: `npx vercel` (preview) and `npx vercel --prod`.
