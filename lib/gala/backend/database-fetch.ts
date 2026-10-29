// Keep the deadline active while the response body is read, not just until headers
// arrive. A timeout is an unknown outcome: callers must retain holds and retry the
// same operation/lease, never infer that a remote write was rolled back.
// Adapters set db.retry=false: the application recovery protocol owns retries,
// and a new SDK's automatic retries must not restart this deadline silently.
export const DATABASE_TIMEOUT_MS = 20_000;
export function databaseFetch(timeoutMs = DATABASE_TIMEOUT_MS, transport: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = inherited ? AbortSignal.any([inherited, deadline]) : deadline;
    return transport(input, { ...init, signal });
  };
}
