require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRES_IN: '24h',
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  UPLOAD_DIR: './uploads'
};
