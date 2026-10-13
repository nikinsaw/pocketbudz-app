import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import type { AiService } from './service.js';

// What the app may ask for. Deliberately narrow: no tools, no model choice, no safety
// settings - the server decides everything except the prompt, an optional JSON schema and
// an optional image or PDF.
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'] as const;
export const MAX_FILE_BYTES = 15 * 1024 * 1024; // same cap the app applies before sending
const MAX_BASE64_CHARS = Math.ceil(MAX_FILE_BYTES / 3) * 4;

const body = z.object({
  // The app puts up to 300 KB of statement text straight into the prompt.
  prompt: z.string().min(1).max(400_000),
  systemInstruction: z.string().max(20_000).optional(),
  responseSchema: z
    .record(z.string(), z.unknown())
    .refine((schema) => JSON.stringify(schema).length <= 20_000, 'Schema too large')
    .optional(),
  file: z
    .object({ mimeType: z.enum(FILE_TYPES), base64: z.string().min(1).max(MAX_BASE64_CHARS) })
    .optional(),
});

export function registerAiRoutes(app: FastifyInstance, ai: AiService) {
  // Sign-in is checked in onRequest, i.e. before the (up to ~20 MB) body is read, so an
  // anonymous caller can't make the server swallow a huge upload.
  const guarded = { onRequest: authenticate };

  app.post(
    '/ai/generate',
    {
      ...guarded,
      bodyLimit: 22 * 1024 * 1024,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => ai.generate(req.userId, body.parse(req.body)),
  );

  app.get('/ai/usage', guarded, async (req) => ai.usage(req.userId));
}
