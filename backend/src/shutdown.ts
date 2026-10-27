import type { FastifyInstance } from 'fastify';

interface ProcessLike {
  on(signal: string, handler: () => void): unknown;
}

// Cloud Run stops a container by sending SIGTERM and killing it ~10 s later. This stops
// taking new requests, lets the ones in flight (an AI call can take 30 s+) finish if they
// can, closes the database, and exits - instead of dying mid-request on every deploy.
export function shutdownOnSignals(options: {
  app: Pick<FastifyInstance, 'close' | 'log'>;
  prisma: { $disconnect(): Promise<void> };
  proc?: ProcessLike;
  exit?: (code: number) => void;
  signals?: string[];
  // Must be under the platform's grace period (Cloud Run: 10 s).
  graceMs?: number;
}) {
  const {
    app,
    prisma,
    proc = process,
    exit = (code) => process.exit(code),
    signals = ['SIGTERM', 'SIGINT'],
    graceMs = 8000,
  } = options;

  let shuttingDown = false;

  const handler = (signal: string) => async () => {
    if (shuttingDown) {
      return; // a second signal must not start a second shutdown
    }
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');

    const forced = setTimeout(() => {
      app.log.error('shutdown took too long, exiting anyway');
      exit(1);
    }, graceMs);
    forced.unref();

    try {
      await app.close();
      await prisma.$disconnect();
      clearTimeout(forced);
      exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'error during shutdown');
      clearTimeout(forced);
      exit(1);
    }
  };

  for (const signal of signals) {
    proc.on(signal, handler(signal));
  }
}
