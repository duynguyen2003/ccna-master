const path = require('node:path');
const dotenv = require('dotenv');

const repositoryDirectory = path.resolve(__dirname, '../../../..');

// Deployment environment variables take priority. Local src/backend/.env is
// optional, and the existing root .env remains a supported fallback.
dotenv.config({ path: path.join(repositoryDirectory, 'src/backend/.env'), quiet: true });
dotenv.config({ path: path.join(repositoryDirectory, '.env'), quiet: true });

const uploadsDirectory = path.resolve(
  repositoryDirectory,
  process.env.UPLOADS_DIR || 'src/storage/uploads'
);

module.exports = { repositoryDirectory, uploadsDirectory };
