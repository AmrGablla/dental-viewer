const fs = require('fs');
const path = require('path');

// Ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Check if file exists
const fileExists = (filePath) => {
  return fs.existsSync(filePath);
};

// Delete file if exists
const deleteFileIfExists = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Delete directory if exists
const deleteDirectoryIfExists = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
};

// Get file extension
const getFileExtension = (filename) => {
  return path.extname(filename);
};

// Generate unique filename
const generateUniqueFilename = (originalName, prefix = '') => {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1E9);
  const ext = getFileExtension(originalName);
  return `${prefix}${timestamp}-${random}${ext}`;
};

module.exports = {
  ensureDirectoryExists,
  fileExists,
  deleteFileIfExists,
  deleteDirectoryIfExists,
  getFileExtension,
  generateUniqueFilename
};
