import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shutdownOnSignals } from './shutdown.js';

function setup(overrides: { close?: () => Promise<void>; disconnect?: () => Promise<void> } = {}) {
  const proc = new EventEmitter();
  const order: string[] = [];
  const app = {
    close: vi.fn(overrides.close ?? (async () => { order.push('app.close'); })),
    log: { info: vi.fn(), error: vi.fn() },
  };
  const prisma = { $disconnect: vi.fn(overrides.disconnect ?? (async () => { order.push('prisma.disconnect'); })) };
  const exit = vi.fn((code: number) => { order.push(`exit(${code})`); });
  shutdownOnSignals({ app: app as never, prisma, proc, exit, graceMs: 50 });
  return { proc, app, prisma, exit, order, signal: (name: string) => { proc.emit(name); return new Promise((r) => setTimeout(r, 5)); } };
}

afterEach(() => vi.useRealTimers());

describe('shutdownOnSignals', () => {
  it('on SIGTERM: stops the server, then the database, then exits 0 - in that order', async () => {
    const { signal, order } = setup();
    await signal('SIGTERM');
    expect(order).toEqual(['app.close', 'prisma.disconnect', 'exit(0)']);
  });

  it('also handles Ctrl+C (SIGINT) for local runs', async () => {
    const { signal, exit } = setup();
    await signal('SIGINT');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('ignores a second signal while already shutting down', async () => {
    const { signal, app, exit } = setup();
    await signal('SIGTERM');
    await signal('SIGTERM');
    await signal('SIGINT');
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('does nothing until a signal arrives', () => {
    const { app, prisma, exit } = setup();
    expect(app.close).not.toHaveBeenCalled();
    expect(prisma.$disconnect).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('exits non-zero if closing fails, and still tries not to hang', async () => {
    const { signal, exit, app } = setup({ close: async () => { throw new Error('close failed'); } });
    await signal('SIGTERM');
    expect(exit).toHaveBeenCalledWith(1);
    expect(app.log.error).toHaveBeenCalled();
  });

  it('forces an exit if a request never finishes, before the platform kills the container', async () => {
    const { signal, exit } = setup({ close: () => new Promise(() => {}) }); // never resolves
    await signal('SIGTERM');
    expect(exit).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 80)); // past the 50 ms grace period
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('does not force-exit after a clean shutdown', async () => {
    const { signal, exit } = setup();
    await signal('SIGTERM');
    await new Promise((r) => setTimeout(r, 80));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
