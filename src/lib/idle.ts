/**
 * Runs `task` when the main thread is idle (or after `timeoutMs` at the
 * latest), falling back to a timer where `requestIdleCallback` is missing
 * (Safari). Returns a function that cancels the pending call.
 */
export function whenIdle(task: () => void, timeoutMs = 2000): () => void {
  if (typeof window === 'undefined') return () => undefined;

  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => task(), { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(task, Math.min(timeoutMs, 1000));
  return () => window.clearTimeout(id);
}
