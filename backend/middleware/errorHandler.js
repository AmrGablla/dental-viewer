const multer = require('multer');

// Error handling middleware
const errorHandler = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB' });
    }
  }
  
  console.error('Error:', error);
  res.status(500).json({ error: 'Server error' });
};

module.exports = errorHandler;
