/**
 * ============================================================
 * FILE: Server.js (REFACTORED)
 * PURPOSE: Express server setup and initialization
 * REFACTORED: From monolithic to modular MVC structure
 * TASKS: Task 1.1 - MVC Folder Structure
 * ============================================================
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initializeDatabase, disconnectDatabase, checkDatabaseHealth } = require('./config/database');
const { requestLogger, adminActionLogger } = require('./middleware/logging');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

/**
 * ============================================================
 * MIDDLEWARE SETUP
 * ============================================================
 */

// Security & parsing middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ file tải lên (tài liệu) từ disk
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging middleware
app.use(requestLogger);

/**
 * ============================================================
 * ROUTE SETUP
 * ============================================================
 */

// Mount API routes
app.use('/api', routes);

// 404 Not Found handler
app.use(notFoundHandler);

// Global error handler (MUST be last middleware)
app.use(errorHandler);

/**
 * ============================================================
 * SERVER START
 * ============================================================
 */

const startServer = async () => {
  try {
    // Initialize database connection
    console.log('Initializing database connection...');
    initializeDatabase();

    // Check database health
    const health = await checkDatabaseHealth();
    if (!health) {
      throw new Error('Database health check failed');
    }
    console.log(' Database is healthy');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`

 CCNA Learning Platform - Backend Server   
  Server running on port ${PORT}           
 API URL: http://localhost:${PORT}/api   
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

/**
 * ============================================================
 * GRACEFUL SHUTDOWN
 * ============================================================
 */

process.on('SIGTERM', async () => {
  console.log(' SIGTERM signal received: closing HTTP server');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await disconnectDatabase();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;