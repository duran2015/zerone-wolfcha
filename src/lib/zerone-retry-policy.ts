/** Speech uses the day-phase hedge; replaying it here would create a third request. */
export function zeroneAttemptLimit(
  isZeroneRequest: boolean,
  streaming: boolean,
  maxAttempts: number,
  batch = false,
): number {
  return isZeroneRequest && (streaming || batch) ? 1 : maxAttempts;
}
