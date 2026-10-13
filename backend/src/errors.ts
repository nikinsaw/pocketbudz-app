export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Extra machine-readable fields sent back alongside `error` (e.g. a `reason` the app
    // can act on). Existing errors have none, so their responses are unchanged.
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}
