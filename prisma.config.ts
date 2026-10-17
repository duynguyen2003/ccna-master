import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

// Nạp các biến môi trường từ file .env
dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Ưu tiên đọc từ biến môi trường DATABASE_URL, nếu không có mới dùng localhost
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/netmastery_db',
  },
});
