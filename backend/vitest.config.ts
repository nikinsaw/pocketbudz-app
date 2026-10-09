import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://pocketbudz:pocketbudz@localhost:5432/pocketbudz_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
      GOOGLE_CLIENT_ID: 'test-client-id',
    },
    fileParallelism: false,
  },
});
