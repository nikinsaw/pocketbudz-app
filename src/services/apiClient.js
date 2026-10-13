// Fetch wrapper for the PocketBudz backend (household mode). Handles the bearer
// token and silent refresh so screens just call request().
//
// Refresh tokens ROTATE: each one works once, and the server treats a reused one
// as theft and revokes every session. So refreshes must be single-flight (many
// requests failing at once share one refresh), and a refresh that fails because
// the network is down must NOT sign the user out - only an explicit rejection does.

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.name = 'ApiError';
    // 0 means the server could not be reached at all.
    this.status = status;
    // The server's whole error body, e.g. { error, reason } - `reason` lets callers react to
    // *why* a request failed (a daily limit, a missing config) and not just its status.
    this.data = data;
  }
}

export function createApiClient({
  baseUrl,
  store,
  fetchImpl = fetch,
  timeoutMs = 15000,
}) {
  let session; // undefined = not loaded from the store yet, null = signed out
  let refreshing = null;
  let onSignedOut = () => {};

  async function getSession() {
    if (session === undefined) {
      session = await store.load();
    }
    return session;
  }

  async function setSession(next) {
    session = next;
    if (next) {
      await store.save(next);
    } else {
      await store.clear();
    }
  }

  async function send(path, { method = 'GET', body, token } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }
      return { status: response.status, ok: response.ok, data };
    } catch {
      throw new ApiError(0, 'Could not reach the server. Check your connection.');
    } finally {
      clearTimeout(timer);
    }
  }

  // Resolves 'ok' | 'rejected'; throws ApiError(0) if the server was unreachable.
  function refresh() {
    if (!refreshing) {
      refreshing = (async () => {
        const current = await getSession();
        if (!current) {
          return 'rejected';
        }
        const result = await send('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: current.refreshToken },
        });
        if (result.ok) {
          await setSession({
            accessToken: result.data.accessToken,
            refreshToken: result.data.refreshToken,
          });
          return 'ok';
        }
        // Only an explicit rejection ends the session. Rate limits (429) and server
        // errors are temporary, so the tokens are kept and the caller can retry.
        if (result.status !== 401 && result.status !== 400) {
          throw new ApiError(result.status, 'Could not refresh your session. Try again shortly.');
        }
        await setSession(null);
        onSignedOut();
        return 'rejected';
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function request(path, { auth = true, ...options } = {}) {
    let used = null;
    if (auth) {
      used = await getSession();
      if (!used) {
        throw new ApiError(401, 'Not signed in');
      }
    }
    let result = await send(path, { ...options, token: used?.accessToken });

    if (auth && result.status === 401) {
      // Another request may already have refreshed while this one was in flight.
      const latest = await getSession();
      const refreshed =
        latest && latest.accessToken !== used.accessToken ? 'ok' : await refresh();
      if (refreshed !== 'ok') {
        throw new ApiError(401, 'Your session has expired. Please sign in again.');
      }
      result = await send(path, { ...options, token: (await getSession()).accessToken });
    }

    if (!result.ok) {
      throw new ApiError(result.status, result.data?.error ?? 'Something went wrong', result.data);
    }
    return result.data;
  }

  return {
    request,
    getSession,
    // Called after /auth/google succeeds.
    startSession: (tokens) =>
      setSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
    // Best-effort server logout, but always clears the device.
    async signOut() {
      const current = await getSession();
      if (current) {
        await send('/auth/logout', {
          method: 'POST',
          body: { refreshToken: current.refreshToken },
        }).catch(() => {});
      }
      await setSession(null);
    },
    // Fires when the server rejects the refresh token (session truly over).
    setOnSignedOut(handler) {
      onSignedOut = handler;
    },
  };
}
