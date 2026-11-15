import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest's hook timeout defaults to 10 seconds, and that is not enough
    // for these suites on a cold Vite transform cache.
    //
    // Each one's beforeAll starts a stub detector, connects mongo, redis and
    // the object store, and then pulls in eight modules with dynamic imports
    // so they read the test settings. Those imports are the expensive part:
    // vitest's own summary measured them at 27% of a 41 second run cold
    // against about 5% warm, which puts the hook over 10 seconds and fails
    // the whole file before a single test runs. The file is then reported as
    // a failed suite with every test skipped, which looks nothing like a
    // failing assertion and is easy to misread.
    //
    // It only ever breaks on the first run after the sources change, which is
    // exactly when the cache is cold, so a warm re-run "fixing" it is
    // misleading rather than reassuring.
    //
    // This lives here rather than as a per-hook argument so that it covers
    // every suite and cannot be lost by an edit to a test file. 30 seconds is
    // three times the worst cold import measured; if a hook ever exceeds it,
    // the cause is something other than the cache.
    hookTimeout: 30_000,

    // The per-test timeout needs the same treatment, for a different reason.
    // The layer 2 tests are the slowest in the suite because each one builds a
    // whole cohort before it asserts anything: five sign-ins with real
    // password hashing, a course, three assignments, twelve uploads through
    // the object store, four baselines, and then eight detector round trips
    // for the ones that score every student twice. That is several seconds of
    // honest work against the real services, and the default 5 seconds leaves
    // no margin for a busy machine. The tests were passing with almost none
    // of it to spare, so one slow run tipped six of them over at once and
    // reported timeouts, which read like broken code and are not.
    //
    // 30 seconds is about six times the slowest of them. Anything that hits
    // this is genuinely stuck, not merely slow.
    testTimeout: 30_000,
  },
});
