// Explicit isolated-test configuration. Never load dotenv or DATABASE_URL.
import { defineConfig } from 'prisma/config';
import path from 'node:path';

const databaseUrl = process.env.AI_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('AI_TEST_DATABASE_URL is required; no application DB fallback');
const target = new URL(databaseUrl);
if (
  !['postgresql:', 'postgres:'].includes(target.protocol) ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
  !/^\/ai_lab_be01_[a-z0-9_]+$/.test(target.pathname)
) {
  throw new Error('AI migration tests require a loopback database named ai_lab_be01_*');
}

export default defineConfig({
  schema: process.env.AI_TEST_SCHEMA || path.join(__dirname, '../../backend/prisma/schema.prisma'),
  migrations: {
    path: process.env.AI_TEST_MIGRATIONS || path.join(__dirname, '../../backend/prisma/migrations'),
  },
  datasource: { url: databaseUrl },
});
