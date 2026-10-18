import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
import path from 'node:path';

// Nạp các biến môi trường từ file .env
dotenv.config({ path: path.join(__dirname, 'src/backend/.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production');
}

export default defineConfig({
  schema: 'src/backend/prisma/schema.prisma',
  migrations: {
    path: 'src/backend/prisma/migrations',
  },
  datasource: {
    // Ưu tiên đọc từ biến môi trường DATABASE_URL, nếu không có mới dùng localhost
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/netmastery_db',
  },
});
