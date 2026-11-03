/**
 * Runs `attempt`, and if it throws, waits briefly and runs it exactly once
 * more. Only for operations that are safe to repeat; the caller decides.
 */
export async function retryOnce<T>(
  attempt: () => Promise<T>,
  {
    delayMs = 250,
    onRetry,
  }: { delayMs?: number; onRetry?: (error: unknown) => void } = {},
): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    onRetry?.(error);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return attempt();
  }
}
