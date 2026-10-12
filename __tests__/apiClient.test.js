import { ApiError, createApiClient } from '../src/services/apiClient';

const reply = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

function setup({ session = { accessToken: 'A1', refreshToken: 'R1' }, responses = {} } = {}) {
  const saved = { current: session };
  const store = {
    load: jest.fn(async () => saved.current),
    save: jest.fn(async (next) => {
      saved.current = next;
    }),
    clear: jest.fn(async () => {
      saved.current = null;
    }),
  };
  const calls = [];
  // handlers: path -> (call) => response; consulted per request.
  const fetchImpl = jest.fn(async (url, init) => {
    const path = url.replace('http://api', '');
    const call = { path, init, auth: init.headers.Authorization };
    calls.push(call);
    const handler = responses[path];
    if (!handler) {
      throw new Error(`unexpected request ${path}`);
    }
    return handler(call);
  });
  const onSignedOut = jest.fn();
  const api = createApiClient({ baseUrl: 'http://api', store, fetchImpl, timeoutMs: 50 });
  api.setOnSignedOut(onSignedOut);
  return { api, store, calls, fetchImpl, onSignedOut, saved };
}

describe('request', () => {
  it('sends the bearer token and parses JSON', async () => {
    const { api, calls } = setup({ responses: { '/me': () => reply(200, { userId: 'u1' }) } });
    await expect(api.request('/me')).resolves.toEqual({ userId: 'u1' });
    expect(calls[0].auth).toBe('Bearer A1');
  });

  it('sends no token for public calls and a JSON body when given one', async () => {
    const { api, calls } = setup({
      session: null,
      responses: { '/auth/google': () => reply(200, { ok: true }) },
    });
    await api.request('/auth/google', { method: 'POST', auth: false, body: { idToken: 'x' } });
    expect(calls[0].auth).toBeUndefined();
    expect(calls[0].init.headers['Content-Type']).toBe('application/json');
    expect(calls[0].init.body).toBe('{"idToken":"x"}');
  });

  it('refuses authenticated calls when signed out, without touching the network', async () => {
    const { api, fetchImpl } = setup({ session: null });
    await expect(api.request('/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('handles empty (204) responses', async () => {
    const { api } = setup({ responses: { '/x': () => reply(204) } });
    await expect(api.request('/x', { method: 'DELETE' })).resolves.toBeNull();
  });

  it('turns server errors into ApiError with the server message', async () => {
    const { api } = setup({ responses: { '/x': () => reply(409, { error: 'Already in a household' }) } });
    const error = await api.request('/x').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect([error.status, error.message]).toEqual([409, 'Already in a household']);
  });

  it('reports an unreachable server as status 0', async () => {
    const { api } = setup({
      responses: {
        '/x': () => {
          throw new TypeError('Network request failed');
        },
      },
    });
    await expect(api.request('/x')).rejects.toMatchObject({ status: 0 });
  });

  it('aborts slow requests', async () => {
    const { api } = setup({
      responses: {
        '/slow': ({ init }) =>
          new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
      },
    });
    await expect(api.request('/slow')).rejects.toMatchObject({ status: 0 });
  });
});

describe('silent refresh', () => {
  const refreshed = () => reply(200, { accessToken: 'A2', refreshToken: 'R2' });

  it('refreshes on 401, saves the rotated tokens and retries once', async () => {
    let attempt = 0;
    const { api, calls, saved } = setup({
      responses: {
        '/me': ({ auth }) => (auth === 'Bearer A1' ? reply(401, { error: 'Unauthorized' }) : reply(200, { userId: (attempt += 1) })),
        '/auth/refresh': refreshed,
      },
    });
    await expect(api.request('/me')).resolves.toEqual({ userId: 1 });
    expect(saved.current).toEqual({ accessToken: 'A2', refreshToken: 'R2' });
    expect(calls.map((c) => c.path)).toEqual(['/me', '/auth/refresh', '/me']);
    expect(JSON.parse(calls[1].init.body)).toEqual({ refreshToken: 'R1' });
  });

  it('shares ONE refresh between simultaneous failing requests (a reused token would revoke every session)', async () => {
    const { api, calls } = setup({
      responses: {
        '/a': ({ auth }) => (auth === 'Bearer A1' ? reply(401) : reply(200, { r: 'a' })),
        '/b': ({ auth }) => (auth === 'Bearer A1' ? reply(401) : reply(200, { r: 'b' })),
        '/c': ({ auth }) => (auth === 'Bearer A1' ? reply(401) : reply(200, { r: 'c' })),
        '/auth/refresh': refreshed,
      },
    });
    const results = await Promise.all([api.request('/a'), api.request('/b'), api.request('/c')]);
    expect(results.map((r) => r.r)).toEqual(['a', 'b', 'c']);
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
  });

  it('a request whose 401 arrives AFTER another request already refreshed just retries with the new token', async () => {
    let releaseB;
    const heldB = new Promise((resolve) => {
      releaseB = resolve;
    });
    const { api, calls } = setup({
      responses: {
        '/a': ({ auth }) => (auth === 'Bearer A1' ? reply(401) : reply(200, { r: 'a' })),
        // B was sent with A1, but its 401 only comes back once A has finished refreshing.
        '/b': ({ auth }) => (auth === 'Bearer A1' ? heldB.then(() => reply(401)) : reply(200, { r: 'b' })),
        '/auth/refresh': refreshed,
      },
    });
    const a = api.request('/a');
    const b = api.request('/b');
    await a; // refresh A1 -> A2 is complete
    releaseB();
    await expect(b).resolves.toEqual({ r: 'b' });

    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
    const retriedB = calls.filter((c) => c.path === '/b').map((c) => c.auth);
    expect(retriedB).toEqual(['Bearer A1', 'Bearer A2']);
  });

  it('signs out when the server rejects the refresh token', async () => {
    const { api, store, onSignedOut, saved } = setup({
      responses: { '/me': () => reply(401), '/auth/refresh': () => reply(401, { error: 'Refresh token reuse detected' }) },
    });
    await expect(api.request('/me')).rejects.toMatchObject({ status: 401 });
    expect(saved.current).toBeNull();
    expect(store.clear).toHaveBeenCalled();
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the network drops during refresh', async () => {
    const { api, saved, onSignedOut } = setup({
      responses: {
        '/me': () => reply(401),
        '/auth/refresh': () => {
          throw new TypeError('Network request failed');
        },
      },
    });
    await expect(api.request('/me')).rejects.toMatchObject({ status: 0 });
    expect(saved.current).toEqual({ accessToken: 'A1', refreshToken: 'R1' });
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it.each([429, 500, 503])('keeps the session when refresh fails with a temporary %i', async (status) => {
    const { api, saved, onSignedOut } = setup({
      responses: { '/me': () => reply(401), '/auth/refresh': () => reply(status, { error: 'later' }) },
    });
    await expect(api.request('/me')).rejects.toMatchObject({ status });
    expect(saved.current).toEqual({ accessToken: 'A1', refreshToken: 'R1' });
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('does not loop: a second 401 after a successful refresh is an error', async () => {
    const { api, calls } = setup({
      responses: { '/me': () => reply(401, { error: 'Unauthorized' }), '/auth/refresh': refreshed },
    });
    await expect(api.request('/me')).rejects.toMatchObject({ status: 401 });
    expect(calls.filter((c) => c.path === '/me')).toHaveLength(2);
  });
});

describe('session lifecycle', () => {
  it('startSession stores the tokens for later requests', async () => {
    const { api, saved, calls } = setup({ session: null, responses: { '/me': () => reply(200, {}) } });
    await api.startSession({ accessToken: 'AX', refreshToken: 'RX', user: { id: 'u' } });
    expect(saved.current).toEqual({ accessToken: 'AX', refreshToken: 'RX' });
    await api.request('/me');
    expect(calls[0].auth).toBe('Bearer AX');
  });

  it('signOut tells the server and clears the device', async () => {
    const { api, saved, calls } = setup({ responses: { '/auth/logout': () => reply(204) } });
    await api.signOut();
    expect(JSON.parse(calls[0].init.body)).toEqual({ refreshToken: 'R1' });
    expect(saved.current).toBeNull();
  });

  it('signOut still clears the device when the server is unreachable', async () => {
    const { api, saved } = setup({
      responses: {
        '/auth/logout': () => {
          throw new TypeError('offline');
        },
      },
    });
    await api.signOut();
    expect(saved.current).toBeNull();
  });
});
