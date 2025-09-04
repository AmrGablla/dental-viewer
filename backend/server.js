const express = require('express');
const cors = require('cors');
const path = require('path');

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

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
