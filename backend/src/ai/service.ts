import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { GeminiError, type Gemini, type GenerateInput } from './gemini.js';

export interface AiResult {
  text: string;
  usage: { used: number; limit: number };
}

// Guards the Gemini key. Every request is charged to a signed-in user's daily allowance
// *before* Google is called, so one account can't run up the bill, and the charge is
// returned if the failure wasn't the user's doing (Google down, key misconfigured...).
export function createAiService(options: {
  prisma: PrismaClient;
  gemini: Gemini;
  dailyLimit: number;
  dayOffsetMinutes: number;
  now?: () => Date;
}) {
  const { prisma, gemini, dailyLimit, dayOffsetMinutes, now = () => new Date() } = options;

  // The limit resets at local midnight for the configured offset, not at UTC midnight.
  function today(): Date {
    const local = new Date(now().getTime() + dayOffsetMinutes * 60_000);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  }

  const release = (userId: string, day: Date) =>
    prisma.aiUsage.updateMany({
      where: { userId, day, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });

  function failure(error: unknown): HttpError {
    if (error instanceof GeminiError) {
      switch (error.kind) {
        case 'not-configured':
          return new HttpError(503, 'AI is not available right now', { reason: 'not-configured' });
        case 'unreachable':
          return new HttpError(502, 'AI is temporarily unavailable', { reason: 'unreachable' });
        case 'empty':
          return new HttpError(502, 'The AI returned no answer', {
            reason: 'empty-response',
            detail: error.detail,
          });
        case 'upstream':
          return new HttpError(502, 'AI is temporarily unavailable', {
            reason: `api-error-${error.detail}`,
          });
      }
    }
    return new HttpError(500, 'AI request failed');
  }

  return {
    async generate(userId: string, input: GenerateInput): Promise<AiResult> {
      const day = today();
      const row = await prisma.aiUsage.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, count: 1 },
        update: { count: { increment: 1 } },
      });
      if (row.count > dailyLimit) {
        await release(userId, day);
        throw new HttpError(429, `You’ve used today’s ${dailyLimit} AI requests. They reset at midnight.`, {
          reason: 'daily-limit',
        });
      }

      try {
        const text = await gemini(input);
        return { text, usage: { used: row.count, limit: dailyLimit } };
      } catch (error) {
        // The model answered but said nothing useful (e.g. blocked): that still cost a call.
        // Everything else is our side or Google's, so the user keeps their request.
        if (!(error instanceof GeminiError && error.kind === 'empty')) {
          await release(userId, day);
        }
        throw failure(error);
      }
    },

    async usage(userId: string): Promise<{ used: number; limit: number }> {
      const row = await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: today() } } });
      return { used: row?.count ?? 0, limit: dailyLimit };
    },
  };
}

export type AiService = ReturnType<typeof createAiService>;
