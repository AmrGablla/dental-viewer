const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Cases table
    db.run(`CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      case_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Insert default admin user if not exists
    db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
      if (!row) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
          ['admin', 'admin@dental.com', hashedPassword]);
        console.log('Default admin user created');
      }
    });
  });
}

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

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.stl')) {
      cb(null, true);
    } else {
      cb(new Error('Only STL files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const rawUpload = multer({ 
  storage: rawStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.stl')) {
      cb(null, true);
    } else {
      cb(new Error('Only STL files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const segmentUpload = multer({ 
  storage: segmentStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.stl') || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only STL or JSON files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Dental Viewer Auth API is running' });
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    db.get("SELECT id FROM users WHERE username = ? OR email = ?", [username, email], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (row) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      // Hash password and create user
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
        [username, email, hashedPassword], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating user' });
        }

        // Generate JWT token
        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
          message: 'User registered successfully',
          token,
          user: { id: this.lastID, username, email }
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = bcrypt.compareSync(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ 
        message: 'Login successful',
        token,
        user: { id: user.id, username: user.username, email: user.email }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  db.get("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  });
});

// Get user cases
app.get('/api/cases', authenticateToken, (req, res) => {
  db.all("SELECT * FROM cases WHERE user_id = ? ORDER BY created_at DESC", [req.user.id], (err, cases) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ cases });
  });
});

// Create new case (without file)
app.post('/api/cases', authenticateToken, (req, res) => {
  try {
    const { case_name } = req.body;
    if (!case_name) {
      return res.status(400).json({ error: 'Case name is required' });
    }

    const caseData = {
      user_id: req.user.id,
      case_name: case_name,
      file_name: '',
      file_path: '',
      status: 'pending'
    };

    db.run("INSERT INTO cases (user_id, case_name, file_name, file_path, status) VALUES (?, ?, ?, ?, ?)",
      [caseData.user_id, caseData.case_name, caseData.file_name, caseData.file_path, caseData.status],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error saving case' });
        }

        res.json({ 
          message: 'Case created successfully',
          case: { 
            id: this.lastID, 
            ...caseData 
          }
        });
      });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload new case (legacy endpoint for backward compatibility)
app.post('/api/cases/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { case_name } = req.body;
    if (!case_name) {
      return res.status(400).json({ error: 'Case name is required' });
    }

    const caseData = {
      user_id: req.user.id,
      case_name: case_name,
      file_name: req.file.originalname,
      file_path: req.file.path,
      status: 'pending'
    };

    db.run("INSERT INTO cases (user_id, case_name, file_name, file_path, status) VALUES (?, ?, ?, ?, ?)",
      [caseData.user_id, caseData.case_name, caseData.file_name, caseData.file_path, caseData.status],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error saving case' });
        }

        res.json({ 
          message: 'Case uploaded successfully',
          case: { 
            id: this.lastID, 
            ...caseData 
          }
        });
      });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get specific case
app.get('/api/cases/:id', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  
  db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.json({ case: caseData });
  });
});

// Delete case
app.delete('/api/cases/:id', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  
  db.get("SELECT file_path FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Delete file from filesystem
    if (fs.existsSync(caseData.file_path)) {
      fs.unlinkSync(caseData.file_path);
    }

    // Delete case directory if it exists
    const caseDir = `./uploads/${caseId}`;
    if (fs.existsSync(caseDir)) {
      fs.rmSync(caseDir, { recursive: true, force: true });
    }

    // Delete from database
    db.run("DELETE FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error deleting case' });
      }
      res.json({ message: 'Case deleted successfully' });
    });
  });
});

// Upload raw file for existing case
app.post('/api/cases/:id/raw', authenticateToken, rawUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const caseId = req.params.id;
    
    // Verify case exists and belongs to user
    db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!caseData) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Update case with new file path and file name
      const newFilePath = req.file.path;
      const fileName = req.file.originalname;
      db.run("UPDATE cases SET file_path = ?, file_name = ? WHERE id = ?", [newFilePath, fileName, caseId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Error updating case' });
        }
        res.json({ 
          message: 'Raw file uploaded successfully',
          file_path: newFilePath,
          file_name: fileName
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get raw file for case
app.get('/api/cases/:id/raw', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  
  db.get("SELECT file_path FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const filePath = caseData.file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(path.resolve(filePath));
  });
});

// Upload segment file for case
app.post('/api/cases/:id/segments', authenticateToken, segmentUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const caseId = req.params.id;
    
    // Verify case exists and belongs to user
    db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!caseData) {
        return res.status(404).json({ error: 'Case not found' });
      }

      res.json({ 
        message: 'Segment file uploaded successfully',
        file_path: req.file.path,
        filename: req.file.filename
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get segments list for case
app.get('/api/cases/:id/segments', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  const segmentsDir = `./uploads/${caseId}/segments`;
  
  // Verify case exists and belongs to user
  db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (!fs.existsSync(segmentsDir)) {
      return res.json({ segments: [] });
    }

    fs.readdir(segmentsDir, (err, files) => {
      if (err) {
        return res.status(500).json({ error: 'Error reading segments directory' });
      }

      const segments = files.map(filename => ({
        id: filename,
        name: filename.replace(/^segment-/, '').replace(/\.[^/.]+$/, ''),
        filename: filename
      }));

      res.json({ segments: segments });
    });
  });
});

// Get specific segment file
app.get('/api/cases/:id/segments/:segmentId', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  const segmentId = req.params.segmentId;
  const filePath = `./uploads/${caseId}/segments/${segmentId}`;
  
  // Verify case exists and belongs to user
  db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Segment file not found' });
    }

    res.sendFile(path.resolve(filePath));
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB' });
    }
  }
  res.status(500).json({ error: 'Server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
