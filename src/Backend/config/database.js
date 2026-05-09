const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

// Singleton pattern for Prisma instance (avoid multiple connections)
let prismaInstance = null;

/**
 * Initialize database connection
 * Uses Prisma v7 with PostgreSQL adapter
 * @returns {PrismaClient} Prisma client instance
 */
const initializeDatabase = () => {
  if (prismaInstance) {
    console.log('♻️  Using existing database connection');
    return prismaInstance;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 
        'postgresql://postgres:123456@localhost:5432/netmastery_db',
    });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter, log: ['error'] });

    console.log('✅ Database connected successfully');
    return prismaInstance;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

/**
 * Get existing Prisma instance
 * @returns {PrismaClient} Prisma client instance
 */
const getPrisma = () => {
  if (!prismaInstance) {
    initializeDatabase();
  }
  return prismaInstance;
};

/**
 * Gracefully disconnect database
 * Call on server shutdown
 */
const disconnectDatabase = async () => {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
      prismaInstance = null;
      console.log('🔌 Database disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting database:', error.message);
    }
  }
};

/**
 * Health check - verify database connection
 * @returns {Promise<boolean>}
 */
const checkDatabaseHealth = async () => {
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
};

module.exports = {
  initializeDatabase,
  getPrisma,
  disconnectDatabase,
  checkDatabaseHealth
};
