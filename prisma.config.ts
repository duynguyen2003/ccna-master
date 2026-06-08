import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

// Nạp các biến môi trường từ file .env
dotenv.config();

declare const process: any;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Ưu tiên đọc từ biến môi trường DATABASE_URL, nếu không có mới dùng localhost
    url: process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/netmastery_db",
  },
});



