// Logging in the shape Google Cloud Logging reads: one JSON object per line on stdout, with
// the level in a `severity` field (so errors show up red and can be alerted on) and the text
// in `message`. Request bodies are never logged - only method, URL and status - so people's
// spending notes and AI prompts don't end up in logs.

const SEVERITY: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

export const cloudSeverity = (level: string) => SEVERITY[level] ?? 'DEFAULT';

export const cloudLoggerOptions = {
  level: 'info',
  messageKey: 'message',
  base: null, // drop pid/hostname noise
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label: string) => ({ severity: cloudSeverity(label) }),
  },
};
