export type ZeroneRequestFailure = {
  status: 502 | 504;
  type: "wolfcha_timeout" | "wolfcha_gateway_error";
  error: string;
};

export function classifyZeroneRequestError(error: unknown, timeoutMs: number): ZeroneRequestFailure {
  const name = error instanceof Error ? error.name : "UnknownError";
  if (name === "TimeoutError" || name === "AbortError") {
    return {
      status: 504,
      type: "wolfcha_timeout",
      error: `Zerone Agent timed out after ${Math.round(timeoutMs / 1000)}s`,
    };
  }
  return {
    status: 502,
    type: "wolfcha_gateway_error",
    error: `Zerone Agent request failed: ${name}`,
  };
}
