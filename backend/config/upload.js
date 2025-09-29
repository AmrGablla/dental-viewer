const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File upload configuration for raw files
const rawStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const caseId = req.params.id;
    const uploadDir = `./uploads/${caseId}/raw`;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'model.stl');
  }
});

// File upload configuration for segments
const segmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const caseId = req.params.id;
    const uploadDir = `./uploads/${caseId}/segments`;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'segment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Legacy storage for backward compatibility
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.stl')) {
    cb(null, true);
  } else {
    cb(new Error('Only STL files are allowed'), false);
  }
};

// Segment file filter function
const segmentFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/octet-stream' || 
      file.originalname.endsWith('.stl') || 
      file.originalname.endsWith('.json')) {
    cb(null, true);
  } else {
    cb(new Error('Only STL or JSON files are allowed'), false);
  }
};

// Upload configurations
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const rawUpload = multer({ 
  storage: rawStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const segmentUpload = multer({ 
  storage: segmentStorage,
  fileFilter: segmentFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

module.exports = {
  upload,
  rawUpload,
  segmentUpload
};
