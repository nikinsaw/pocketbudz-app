import { ApiError } from '../src/services/apiClient';
import { AIUnavailableError, createCallGemini, describeAIError } from '../src/services/aiClient';

const fakeApi = (impl) => ({ request: jest.fn(impl) });
const failWith = (status, message = 'x', data = null) => () => Promise.reject(new ApiError(status, message, data));

describe('callGemini (through the PocketBudz server)', () => {
  it('posts the request to /ai/generate and returns just the text', async () => {
    const api = fakeApi(async () => ({ text: 'The answer', usage: { used: 1, limit: 100 } }));
    const answer = await createCallGemini(api)({ prompt: 'hello' });
    expect(answer).toBe('The answer');
    expect(api.request).toHaveBeenCalledWith('/ai/generate', { method: 'POST', body: { prompt: 'hello' } });
  });

  it('forwards the system instruction, schema and file exactly as before', async () => {
    const api = fakeApi(async () => ({ text: '{}' }));
    const input = { prompt: 'read', systemInstruction: 'sys', responseSchema: { type: 'OBJECT' }, file: { mimeType: 'image/png', base64: 'AAAA' } };
    await createCallGemini(api)(input);
    expect(api.request.mock.calls[0][1].body).toEqual(input);
  });

  it('never has a key to send: nothing in the request carries one', async () => {
    const api = fakeApi(async () => ({ text: 'ok' }));
    await createCallGemini(api)({ prompt: 'p' });
    expect(JSON.stringify(api.request.mock.calls[0])).not.toMatch(/key|AIza/i);
  });
});

describe('failures become reasons the app understands', () => {
  const reasonOf = async (impl) => (await createCallGemini(fakeApi(impl))({ prompt: 'p' }).catch((e) => e));

  it.each([
    ['offline', failWith(0), 'offline'],
    ['not signed in', failWith(401, 'Not signed in'), 'sign-in-required'],
    ['session ended', failWith(401, 'Your session has expired. Please sign in again.'), 'sign-in-required'],
    ['AI not set up on the server', failWith(503, 'AI is not available right now', { reason: 'not-configured' }), 'not-configured'],
    ['server can’t reach Gemini', failWith(502, 'AI is temporarily unavailable', { reason: 'unreachable' }), 'unreachable'],
    ['Gemini busy', failWith(502, 'AI is temporarily unavailable', { reason: 'api-error-429' }), 'api-error-429'],
    ['server problem with no reason', failWith(500, 'AI request failed'), 'api-error-500'],
    ['a bad request', failWith(400, 'Invalid request'), 'api-error-400'],
  ])('%s -> %s', async (_name, impl, reason) => {
    const error = await reasonOf(impl);
    expect(error).toBeInstanceOf(AIUnavailableError);
    expect(error.reason).toBe(reason);
  });

  it('keeps the server’s sentence for the daily limit, which names the number', async () => {
    const error = await reasonOf(failWith(429, 'You’ve used today’s 100 AI requests. They reset at midnight.', { reason: 'daily-limit' }));
    expect(error.reason).toBe('daily-limit');
    expect(describeAIError(error)).toBe('You’ve used today’s 100 AI requests. They reset at midnight.');
  });

  it('keeps why Gemini declined to answer', async () => {
    const error = await reasonOf(failWith(502, 'The AI returned no answer', { reason: 'empty-response', detail: 'SAFETY' }));
    expect(error).toMatchObject({ reason: 'empty-response', detail: 'SAFETY' });
  });

  it('an unreachable-with-no-status error is still "unreachable", never a crash', async () => {
    const error = await reasonOf(() => Promise.reject(new Error('weird')));
    expect(error).toBeInstanceOf(AIUnavailableError);
    expect(error.reason).toBe('unreachable');
  });
});

describe('describeAIError', () => {
  const say = (reason, detail) => describeAIError(new AIUnavailableError(reason, detail));

  it('asks for sign-in when that is what is missing', () => {
    expect(say('sign-in-required')).toBe('Sign in with Google to use AI features.');
  });

  it('explains being offline, busy, or unavailable in plain words', () => {
    expect(say('offline')).toMatch(/need internet/);
    expect(say('api-error-429')).toMatch(/busy/);
    expect(say('unreachable')).toMatch(/temporarily unavailable/);
    expect(say('not-configured')).toMatch(/isn.t available/);
  });

  it('says why the AI declined, in lower case, or that it was empty', () => {
    expect(say('empty-response', 'SAFETY')).toMatch(/declined to answer \(safety\)/);
    expect(say('empty-response', 'STOP')).toMatch(/empty response/);
    expect(say('empty-response')).toMatch(/empty response/);
  });

  it('falls back to a generic message for the daily limit without a server sentence', () => {
    expect(say('daily-limit')).toMatch(/reset at midnight/);
  });

  it('never tells a person to fix an API key or an .env file - that is not theirs to fix', () => {
    for (const reason of ['offline', 'sign-in-required', 'daily-limit', 'not-configured', 'unreachable', 'api-error-401', 'api-error-403', 'api-error-404', 'api-error-500', 'weird-reason']) {
      expect(say(reason)).not.toMatch(/api key|\.env|GEMINI/i);
    }
  });

  it('copes with a non-AI error', () => {
    expect(describeAIError(new Error('boom'))).toBe('Something went wrong — try again.');
  });
});
