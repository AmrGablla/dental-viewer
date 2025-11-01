const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Import configuration
const { PORT } = require('./config/constants');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const caseRoutes = require('./routes/cases');
const segmentRoutes = require('./routes/segments');
const debugRoutes = require('./routes/debug');

const app = express();

// Enable compression for all responses (gzip/deflate)
// BUT skip compression for file downloads (they're binary and already compressed)
app.use(compression({
  filter: (req, res) => {
    // Don't compress file downloads (binary files)
    if (req.path.includes('/raw') || req.path.includes('/segments/') || req.path.endsWith('.stl')) {
      return false;
    }
    // Don't compress multipart uploads
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9, 6 is default and good balance)
  threshold: 1024 // Only compress responses larger than 1KB
}));

// CORS configuration with optimizations
app.use(cors({
  credentials: true,
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Increase payload size limits for large file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads directory with caching
app.use('/uploads', express.static('uploads', {
  maxAge: '1d', // Cache static files for 1 day
  etag: true, // Enable ETags for cache validation
  lastModified: true, // Enable Last-Modified headers
  immutable: false, // Don't mark as immutable since files can change
  setHeaders: (res, path) => {
    // Set custom headers for STL files
    if (path.endsWith('.stl')) {
      res.setHeader('Content-Type', 'application/octet-stream');
      // Enable range requests for large files
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Dental Viewer Auth API is running' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/cases', segmentRoutes); // Segments are nested under cases
app.use('/api/debug', debugRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
