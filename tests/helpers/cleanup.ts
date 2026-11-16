/**
 * Scoped cleanup contract — only delete rows tagged with the current TEST_RUN_ID.
 * Implementations must run server-side (TEST_DATABASE_URL), never in the browser bundle.
 */

export function assertScopedCleanup(runId: string, tag: string): void {
  if (!runId || runId.length < 4) {
    throw new Error('Refusing cleanup without TEST_RUN_ID')
  }
  if (!tag.includes(runId)) {
    throw new Error('Refusing cleanup of fixture not owned by this TEST_RUN_ID')
  }
}

export function cleanupNotImplementedMessage(runId: string): string {
  return `Cleanup for run ${runId} requires TEST_DATABASE_URL + staging factories (not implemented as broad DELETE)`
}
