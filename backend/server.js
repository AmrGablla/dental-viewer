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

    // Segments table
    db.run(`CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#00ff00',
      tooth_type TEXT DEFAULT 'incisor',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE
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
    db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), req.user.id], (err, caseData) => {
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
    db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), req.user.id], (err, caseData) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!caseData) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Extract segment name from filename or use default
      const segmentName = req.body.name || req.file.filename.replace(/^segment-/, '').replace(/\.[^/.]+$/, '');
      
      // Save segment metadata to database
      db.run(
        "INSERT INTO segments (case_id, filename, name, color, tooth_type) VALUES (?, ?, ?, ?, ?)",
        [parseInt(caseId), req.file.filename, segmentName, req.body.color || '#00ff00', req.body.tooth_type || 'incisor'],
        function(err) {
          if (err) {
            console.error('Error saving segment metadata:', err);
            return res.status(500).json({ error: 'Failed to save segment metadata' });
          }

          res.json({ 
            message: 'Segment file uploaded successfully',
            file_path: req.file.path,
            filename: req.file.filename,
            segment_id: this.lastID,
            name: segmentName
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get segments list for case
app.get('/api/cases/:id/segments', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  
  // Verify case exists and belongs to user
  db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Get segments from database
    db.all("SELECT * FROM segments WHERE case_id = ? ORDER BY created_at ASC", [parseInt(caseId)], (err, segments) => {
      if (err) {
        return res.status(500).json({ error: 'Error reading segments from database' });
      }

      // Check if files still exist and add file info
      const segmentsWithFileInfo = segments.map(segment => {
        const filePath = `./uploads/${caseId}/segments/${segment.filename}`;
        const fileExists = fs.existsSync(filePath);
        
        return {
          id: segment.id,
          name: segment.name,
          filename: segment.filename,
          color: segment.color,
          tooth_type: segment.tooth_type,
          created_at: segment.created_at,
          updated_at: segment.updated_at,
          file_exists: fileExists
        };
      });

      // If no segments in database, check filesystem for backward compatibility
      if (segmentsWithFileInfo.length === 0) {
        const segmentsDir = `./uploads/${caseId}/segments`;
        if (fs.existsSync(segmentsDir)) {
          fs.readdir(segmentsDir, (err, files) => {
            if (err) {
              return res.json({ segments: [] });
            }

            const legacySegments = files.map(filename => ({
              id: filename,
              name: filename.replace(/^segment-/, '').replace(/\.[^/.]+$/, ''),
              filename: filename,
              color: '#00ff00',
              tooth_type: 'incisor',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              file_exists: true
            }));

            res.json({ segments: legacySegments });
          });
        } else {
          res.json({ segments: [] });
        }
      } else {
        res.json({ segments: segmentsWithFileInfo });
      }
    });
  });
});

// Get specific segment file
app.get('/api/cases/:id/segments/:segmentId', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  const segmentId = req.params.segmentId;
  
  // Verify case exists and belongs to user
  db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Get segment info from database
    db.get("SELECT * FROM segments WHERE id = ? AND case_id = ?", [parseInt(segmentId), parseInt(caseId)], (err, segment) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      const filePath = `./uploads/${caseId}/segments/${segment.filename}`;
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Segment file not found' });
      }

      res.sendFile(path.resolve(filePath));
    });
  });
});

// Update segment metadata (name, color, tooth_type)
app.put('/api/cases/:id/segments/:segmentId', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  const segmentId = req.params.segmentId;
  
  // Verify case exists and belongs to user
  db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Verify segment exists and belongs to this case
    db.get("SELECT * FROM segments WHERE id = ? AND case_id = ?", [parseInt(segmentId), parseInt(caseId)], (err, segment) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      // Update segment metadata
      const { name, color, tooth_type } = req.body;
      const updates = [];
      const values = [];
      
      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (color !== undefined) {
        updates.push('color = ?');
        values.push(color);
      }
      if (tooth_type !== undefined) {
        updates.push('tooth_type = ?');
        values.push(tooth_type);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(parseInt(segmentId), parseInt(caseId));
      
      const query = `UPDATE segments SET ${updates.join(', ')} WHERE id = ? AND case_id = ?`;
      
      db.run(query, values, function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update segment' });
        }
        
        res.json({ 
          message: 'Segment updated successfully',
          segment_id: segmentId
        });
      });
    });
  });
});

// Delete segment
app.delete('/api/cases/:id/segments/:segmentId', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  const segmentId = req.params.segmentId;
  
  // Verify case exists and belongs to user
  db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Get segment info before deletion
    db.get("SELECT * FROM segments WHERE id = ? AND case_id = ?", [parseInt(segmentId), parseInt(caseId)], (err, segment) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      // Delete segment file
      const filePath = `./uploads/${caseId}/segments/${segment.filename}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete segment from database
      db.run("DELETE FROM segments WHERE id = ? AND case_id = ?", [parseInt(segmentId), parseInt(caseId)], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete segment' });
        }
        
        res.json({ 
          message: 'Segment deleted successfully',
          segment_id: segmentId
        });
      });
    });
  });
});

// Migrate existing segments to database (for backward compatibility)
app.post('/api/cases/:id/segments/migrate', authenticateToken, (req, res) => {
  const caseId = req.params.id;
  
  // Verify case exists and belongs to user
  db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, req.user.id], (err, caseData) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const segmentsDir = `./uploads/${caseId}/segments`;
    if (!fs.existsSync(segmentsDir)) {
      return res.json({ message: 'No segments directory found', migrated: 0 });
    }

    fs.readdir(segmentsDir, (err, files) => {
      if (err) {
        return res.status(500).json({ error: 'Error reading segments directory' });
      }

      let migratedCount = 0;
      const stlFiles = files.filter(file => file.endsWith('.stl'));

      if (stlFiles.length === 0) {
        return res.json({ message: 'No STL files found', migrated: 0 });
      }

      // Check which files are already in database
      db.all("SELECT filename FROM segments WHERE case_id = ?", [parseInt(caseId)], (err, existingSegments) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const existingFilenames = existingSegments.map(s => s.filename);
        const newFiles = stlFiles.filter(file => !existingFilenames.includes(file));

        if (newFiles.length === 0) {
          return res.json({ message: 'All segments already migrated', migrated: 0 });
        }

        // Insert new segments into database
        let completed = 0;
        newFiles.forEach(filename => {
          const segmentName = filename.replace(/^segment-/, '').replace(/\.[^/.]+$/, '');
          
          db.run(
            "INSERT INTO segments (case_id, filename, name, color, tooth_type) VALUES (?, ?, ?, ?, ?)",
            [parseInt(caseId), filename, segmentName, '#00ff00', 'incisor'],
            function(err) {
              if (err) {
                console.error('Error migrating segment:', err);
              } else {
                migratedCount++;
              }
              
              completed++;
              if (completed === newFiles.length) {
                res.json({ 
                  message: `Migrated ${migratedCount} segments to database`,
                  migrated: migratedCount
                });
              }
            }
          );
        });
      });
    });
  });
});

// Debug endpoint to check segments in database
app.get('/api/debug/segments/:caseId', authenticateToken, (req, res) => {
  const caseId = req.params.caseId;
  
  db.all("SELECT * FROM segments WHERE case_id = ?", [parseInt(caseId)], (err, segments) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    res.json({ 
      caseId: caseId,
      segments: segments,
      count: segments.length
    });
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
